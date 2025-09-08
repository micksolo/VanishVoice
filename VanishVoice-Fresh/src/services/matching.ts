import { supabase } from './supabase';

export interface MatchResult {
  matched: boolean;
  conversationId?: string;
  partnerId?: string;
  message?: string;
}

export interface MatchPreferences {
  gender?: 'male' | 'female' | 'any';
  country?: string;
  continent?: string;
}

class MatchingEngine {
  private pollingInterval: NodeJS.Timeout | null = null;
  private subscription: any = null;
  private matchFoundCallback: ((result: MatchResult) => void) | null = null;

  async findMatch(
    sessionId: string, 
    preferences: MatchPreferences = {},
    onMatchFound?: (result: MatchResult) => void
  ): Promise<void> {
    try {
      this.matchFoundCallback = onMatchFound || null;

      // First, start listening for matches (before calling edge function)
      this.startPolling(sessionId);
      
      // Then call edge function to join waiting pool and find match
      const { data, error } = await supabase.functions.invoke('match-users', {
        body: {
          sessionId,
          preferences
        }
      });

      if (error) {
        this.stopPolling();
        throw error;
      }

      if (data.matched) {
        // Match found immediately
        console.log('[MatchingEngine] Immediate match found:', data);
        this.handleMatchFound(data);
      } else {
        console.log('[MatchingEngine] Added to waiting pool, listening for matches...');
      }
    } catch (error) {
      console.error('Error finding match:', error);
      throw error;
    }
  }

  private startPolling(sessionId: string) {
    console.log('[MatchingEngine] Starting real-time match detection for session:', sessionId);
    
    // Subscribe to real-time updates for new conversations
    const subscription = supabase
      .channel(`match-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'anonymous_conversations',
          filter: `session_a=eq.${sessionId}`
        },
        (payload) => {
          console.log('[MatchingEngine] New conversation as session_a:', payload);
          this.handleNewConversation(payload.new, sessionId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'anonymous_conversations',
          filter: `session_b=eq.${sessionId}`
        },
        (payload) => {
          console.log('[MatchingEngine] New conversation as session_b:', payload);
          this.handleNewConversation(payload.new, sessionId);
        }
      )
      .subscribe((status) => {
        console.log('[MatchingEngine] Subscription status:', status);
      });

    // Store subscription for cleanup
    this.subscription = subscription;

    // Also do an initial check in case match already exists
    this.checkForExistingMatch(sessionId);
  }

  private async checkForExistingMatch(sessionId: string) {
    try {
      const { data: conversations, error } = await supabase
        .from('anonymous_conversations')
        .select('*')
        .or(`session_a.eq.${sessionId},session_b.eq.${sessionId}`)
        .is('ended_at', null)
        .order('started_at', { ascending: false });

      if (error) {
        console.error('[MatchingEngine] Error checking existing match:', error);
        return;
      }

      if (conversations && conversations.length > 0) {
        const conversation = conversations[0];
        console.log('[MatchingEngine] Found existing match:', conversation);
        this.handleNewConversation(conversation, sessionId);
      }
    } catch (error) {
      console.error('[MatchingEngine] Exception checking existing match:', error);
    }
  }

  private handleNewConversation(conversation: any, sessionId: string) {
    console.log('[MatchingEngine] Processing new conversation:', conversation);
    
    // Stop listening for more matches
    this.stopPolling();
    
    const partnerId = conversation.session_a === sessionId 
      ? conversation.session_b 
      : conversation.session_a;

    this.handleMatchFound({
      matched: true,
      conversationId: conversation.id,
      partnerId
    });
  }

  private stopPolling() {
    console.log('[MatchingEngine] Stopping match detection');
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private handleMatchFound(result: MatchResult) {
    if (this.matchFoundCallback) {
      this.matchFoundCallback(result);
    }
  }

  async cancelSearch(sessionId: string) {
    try {
      this.stopPolling();

      // Remove from waiting pool
      await supabase
        .from('waiting_pool')
        .delete()
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error canceling search:', error);
    }
  }

  async skipCurrentMatch(conversationId: string, sessionId: string, deviceHash: string) {
    try {
      // End current conversation
      const { error } = await supabase
        .from('anonymous_conversations')
        .update({ 
          ended_at: new Date().toISOString(),
          end_reason: 'skipped'
        })
        .eq('id', conversationId);

      if (error) throw error;

      // Update trust score
      await supabase.functions.invoke('update-trust-score', {
        body: {
          deviceHash,
          action: 'skip'
        }
      });

    } catch (error) {
      console.error('Error skipping match:', error);
      throw error;
    }
  }

  async reportUser(
    conversationId: string, 
    reporterSessionId: string,
    reporterDeviceHash: string,
    reportedSessionId: string,
    reason: 'inappropriate' | 'spam' | 'underage' | 'harassment' | 'other',
    details?: string
  ) {
    try {
      // Get reported user's device hash
      const { data: reportedSession } = await supabase
        .from('anonymous_sessions')
        .select('device_hash')
        .eq('id', reportedSessionId)
        .single();

      if (!reportedSession) throw new Error('Session not found');

      // Create report
      const { error: reportError } = await supabase
        .from('anonymous_reports')
        .insert({
          conversation_id: conversationId,
          reporter_device_hash: reporterDeviceHash,
          reported_device_hash: reportedSession.device_hash,
          reason,
          details
        });

      if (reportError) throw reportError;

      // End conversation
      await supabase
        .from('anonymous_conversations')
        .update({ 
          ended_at: new Date().toISOString(),
          end_reason: 'reported'
        })
        .eq('id', conversationId);

      // Update trust scores
      await supabase.functions.invoke('update-trust-score', {
        body: {
          deviceHash: reportedSession.device_hash,
          action: 'report'
        }
      });

    } catch (error) {
      console.error('Error reporting user:', error);
      throw error;
    }
  }

  async endConversation(conversationId: string, deviceHash: string) {
    try {
      // Mark conversation as completed
      const { error } = await supabase
        .from('anonymous_conversations')
        .update({ 
          ended_at: new Date().toISOString(),
          end_reason: 'completed'
        })
        .eq('id', conversationId);

      if (error) throw error;

      // Positive trust score update for completing conversation
      await supabase.functions.invoke('update-trust-score', {
        body: {
          deviceHash,
          action: 'complete'
        }
      });

    } catch (error) {
      console.error('Error ending conversation:', error);
      throw error;
    }
  }
}

export default new MatchingEngine();