import { supabase } from './supabase';
import { ExpiryRule } from '../types/database';

/**
 * ChatSessionService - Manages chat sessions and message clearing
 * 
 * This service handles:
 * - Chat session management
 * - Message clearing on both devices
 * - Session state tracking
 * - Ephemeral message lifecycle
 */

export interface SessionClearingResult {
  success: boolean;
  messagesCleared: number;
  error?: string;
}

export interface ChatSession {
  id: string;
  participants: string[];
  created_at: Date;
  last_activity: Date;
  is_active: boolean;
  message_count: number;
}

export class ChatSessionService {
  /**
   * Gets or creates a chat session between two users
   */
  static async getOrCreateSession(userId1: string, userId2: string): Promise<string> {
    try {
      // Try to find existing session
      const { data: existingSession, error: findError } = await supabase
        .from('chat_sessions')
        .select('*')
        .or(`participants.cs.{${userId1},${userId2}},participants.cs.{${userId2},${userId1}}`)
        .single();

      if (existingSession && !findError) {
        return existingSession.id;
      }

      // Create new session
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const { error: createError } = await supabase
        .from('chat_sessions')
        .insert({
          id: sessionId,
          participants: [userId1, userId2],
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          is_active: true,
          message_count: 0,
        });

      if (createError) {
        console.error('Error creating chat session:', createError);
        throw createError;
      }

      return sessionId;
    } catch (error) {
      console.error('Error in getOrCreateSession:', error);
      // Fallback to a simple session ID
      return `fallback_${userId1}_${userId2}`;
    }
  }

  /**
   * Updates session activity timestamp
   */
  static async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({
          last_activity: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error updating session activity:', error);
      }
    } catch (error) {
      console.error('Error in updateSessionActivity:', error);
    }
  }

  /**
   * Clears all messages in a chat session for both participants
   */
  static async clearSessionForBothDevices(
    sessionId: string,
    userId: string,
    friendId: string
  ): Promise<SessionClearingResult> {
    try {
      // Get all messages in the session
      const { data: messages, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .or(`sender_id.eq.${friendId},recipient_id.eq.${friendId}`);

      if (fetchError) {
        return {
          success: false,
          messagesCleared: 0,
          error: fetchError.message,
        };
      }

      const messageCount = messages?.length || 0;

      // Mark all messages as cleared for both users
      const { error: clearError } = await supabase
        .from('messages')
        .update({
          sender_cleared: true,
          recipient_cleared: true,
          cleared_at: new Date().toISOString(),
        })
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .or(`sender_id.eq.${friendId},recipient_id.eq.${friendId}`);

      if (clearError) {
        return {
          success: false,
          messagesCleared: 0,
          error: clearError.message,
        };
      }

      // Update session
      await this.updateSessionActivity(sessionId);

      return {
        success: true,
        messagesCleared: messageCount,
      };
    } catch (error) {
      return {
        success: false,
        messagesCleared: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Marks the session as inactive
   */
  static async deactivateSession(sessionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({
          is_active: false,
          last_activity: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error deactivating session:', error);
      }
    } catch (error) {
      console.error('Error in deactivateSession:', error);
    }
  }

  /**
   * Gets session information
   */
  static async getSessionInfo(sessionId: string): Promise<ChatSession | null> {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        participants: data.participants,
        created_at: new Date(data.created_at),
        last_activity: new Date(data.last_activity),
        is_active: data.is_active,
        message_count: data.message_count,
      };
    } catch (error) {
      console.error('Error getting session info:', error);
      return null;
    }
  }

  /**
   * Increments message count for a session
   */
  static async incrementMessageCount(sessionId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_message_count', {
        session_id: sessionId,
      });

      if (error) {
        console.error('Error incrementing message count:', error);
      }
    } catch (error) {
      console.error('Error in incrementMessageCount:', error);
    }
  }

  /**
   * Gets active sessions for a user
   */
  static async getUserActiveSessions(userId: string): Promise<ChatSession[]> {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .contains('participants', [userId])
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map(session => ({
        id: session.id,
        participants: session.participants,
        created_at: new Date(session.created_at),
        last_activity: new Date(session.last_activity),
        is_active: session.is_active,
        message_count: session.message_count,
      }));
    } catch (error) {
      console.error('Error getting user active sessions:', error);
      return [];
    }
  }

  /**
   * End a chat session and perform cleanup
   */
  static async endSession(
    userId: string, 
    friendId: string, 
    clearMessages: boolean = false
  ): Promise<{ success: boolean; totalTextMessagesCleared: number; error?: string }> {
    try {
      console.log(`[ChatSessionService] Ending session between ${userId} and ${friendId}`);
      
      // Find the session between these users
      const sessionId = await this.getOrCreateSession(userId, friendId);
      
      // Deactivate the session
      await this.deactivateSession(sessionId);
      
      let totalTextMessagesCleared = 0;
      
      if (clearMessages) {
        // Clear messages if requested
        const clearResult = await this.clearSessionForBothDevices(sessionId, userId, friendId);
        totalTextMessagesCleared = clearResult.messagesCleared;
        
        if (!clearResult.success) {
          console.warn('[ChatSessionService] Failed to clear messages:', clearResult.error);
        }
      }
      
      console.log(`[ChatSessionService] ✅ Session ended successfully, cleared ${totalTextMessagesCleared} messages`);
      
      return {
        success: true,
        totalTextMessagesCleared,
      };
      
    } catch (error) {
      console.error('[ChatSessionService] Error ending session:', error);
      return {
        success: false,
        totalTextMessagesCleared: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Start a chat session
   */
  static async startSession(userId: string, friendId: string): Promise<string> {
    try {
      const sessionId = await this.getOrCreateSession(userId, friendId);
      
      // Update session to active
      const { error } = await supabase
        .from('chat_sessions')
        .update({
          is_active: true,
          last_activity: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error starting session:', error);
      }

      console.log(`[ChatSessionService] Started session: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error('Error in startSession:', error);
      return await this.getOrCreateSession(userId, friendId);
    }
  }

  /**
   * Subscribe to session clearing events
   */
  static onSessionClearing(
    sessionId: string,
    callback: (result: SessionClearingResult) => void
  ): () => void {
    console.log(`[ChatSessionService] Setting up session clearing subscription for ${sessionId}`);
    
    // In a real implementation, this would subscribe to real-time events
    // For now, return a cleanup function
    return () => {
      console.log(`[ChatSessionService] Cleaned up session clearing subscription for ${sessionId}`);
    };
  }
}

export { SessionClearingResult };