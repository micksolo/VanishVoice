import { supabase } from './supabase';
import { ExpiryRule, Message } from '../types/database';

/**
 * Service for handling ephemeral message functionality
 * Manages message viewing, expiry, and cleanup
 */
export class EphemeralMessageService {
  
  /**
   * Mark a message as viewed and handle immediate expiry if needed
   */
  static async markMessageViewed(messageId: string): Promise<boolean> {
    try {
      console.log(`[EphemeralMessage] Marking message ${messageId} as viewed`);
      
      // Use the database function to mark as viewed and handle expiry
      const { data, error } = await supabase
        .rpc('mark_message_viewed', { message_id: messageId });

      if (error) {
        console.error('[EphemeralMessage] Error marking message as viewed:', error);
        return false;
      }

      console.log(`[EphemeralMessage] Message ${messageId} marked as viewed`);
      return data === true;
      
    } catch (error) {
      console.error('[EphemeralMessage] Failed to mark message as viewed:', error);
      return false;
    }
  }

  /**
   * Check if a message should expire based on its expiry rule
   */
  static shouldMessageExpire(message: Message): boolean {
    const now = new Date();
    const createdAt = new Date(message.created_at);
    
    switch (message.expiry_rule.type) {
      case 'none':
        return false;
        
      case 'view':
        return message.viewed_at !== null;
        
      case 'read':
        return message.read_at !== null;
        
      case 'playback':
        return message.listened_at !== null;
        
      case 'time':
        const expiryTime = new Date(createdAt.getTime() + (message.expiry_rule.duration_sec * 1000));
        return now > expiryTime;
        
      case 'location':
        // Location-based expiry not implemented yet
        return false;
        
      case 'event':
        // Event-based expiry not implemented yet
        return false;
        
      default:
        return false;
    }
  }

  /**
   * Get human-readable expiry description
   */
  static getExpiryDescription(expiryRule: ExpiryRule): string {
    switch (expiryRule.type) {
      case 'none':
        return 'Never expires';
        
      case 'view':
        return 'Disappears after viewing';
        
      case 'read':
        return 'Disappears after reading';
        
      case 'playback':
        return 'Disappears after playing';
        
      case 'time':
        const hours = Math.floor(expiryRule.duration_sec / 3600);
        const minutes = Math.floor((expiryRule.duration_sec % 3600) / 60);
        const seconds = expiryRule.duration_sec % 60;
        
        if (hours > 0) {
          return `Expires in ${hours}h ${minutes}m`;
        } else if (minutes > 0) {
          return `Expires in ${minutes}m ${seconds}s`;
        } else {
          return `Expires in ${seconds}s`;
        }
        
      case 'location':
        return 'Expires when you leave this area';
        
      case 'event':
        return 'Expires after event';
        
      default:
        return 'Unknown expiry';
    }
  }

  /**
   * Get time remaining until expiry (for time-based expiry)
   */
  static getTimeRemaining(message: Message): number | null {
    if (message.expiry_rule.type !== 'time') {
      return null;
    }
    
    const now = new Date();
    const createdAt = new Date(message.created_at);
    const expiryTime = new Date(createdAt.getTime() + (message.expiry_rule.duration_sec * 1000));
    
    return Math.max(0, expiryTime.getTime() - now.getTime());
  }

  /**
   * Check if message is ephemeral (will disappear)
   */
  static isEphemeral(expiryRule: ExpiryRule): boolean {
    return expiryRule.type !== 'none';
  }

  /**
   * Check if message disappears immediately after viewing
   */
  static disappearsAfterViewing(expiryRule: ExpiryRule): boolean {
    return expiryRule.type === 'view' || 
           expiryRule.type === 'read' || 
           expiryRule.type === 'playback';
  }

  /**
   * Get default expiry rules for different message types
   */
  static getDefaultExpiryRules() {
    return {
      none: { type: 'none' } as ExpiryRule,
      viewOnce: { type: 'view', disappear_after_view: true } as ExpiryRule,
      readOnce: { type: 'read' } as ExpiryRule,
      playOnce: { type: 'playback' } as ExpiryRule,
      oneHour: { type: 'time', duration_sec: 3600 } as ExpiryRule,
      oneDay: { type: 'time', duration_sec: 86400 } as ExpiryRule,
      oneWeek: { type: 'time', duration_sec: 604800 } as ExpiryRule,
    };
  }

  /**
   * Subscribe to message expiry updates
   */
  static subscribeToMessageExpiry(
    callback: (messageId: string) => void
  ) {
    return supabase
      .channel('message_expiry')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: 'expired=eq.true'
        },
        (payload) => {
          console.log('[EphemeralMessage] Message expired:', payload.new.id);
          callback(payload.new.id);
        }
      )
      .subscribe();
  }

  /**
   * Subscribe to message deletion and expiry updates (for hard deletes and soft deletes)
   */
  static subscribeToMessageDeletion(
    userId: string,
    callback: (messageId: string) => void
  ) {
    return supabase
      .channel(`message_deletion_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Check if the user is involved in this message
          if (payload.old.sender_id === userId || payload.old.recipient_id === userId) {
            console.log('[EphemeralMessage] Message deleted:', payload.old.id);
            callback(payload.old.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: 'expired=eq.true'
        },
        (payload) => {
          // Check if the user is involved in this expired message
          if (payload.new.sender_id === userId || payload.new.recipient_id === userId) {
            console.log('[EphemeralMessage] Message expired for user:', payload.new.id);
            callback(payload.new.id);
          }
        }
      )
      .subscribe();
  }

  /**
   * Get deletion statistics for the current user
   */
  static async getDeletionStats(userId: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_deletion_stats', { user_id: userId });

      if (error) {
        console.error('[EphemeralMessage] Error getting deletion stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[EphemeralMessage] Failed to get deletion stats:', error);
      return null;
    }
  }

  /**
   * Handle message viewing for different message types
   */
  static async handleMessageView(message: Message, viewType: 'read' | 'play' | 'view'): Promise<void> {
    // Always mark as viewed for tracking
    await this.markMessageViewed(message.id);

    // Update specific view type if needed
    const updates: Partial<Message> = {};
    
    switch (viewType) {
      case 'read':
        if (!message.read_at) {
          updates.read_at = new Date().toISOString();
        }
        break;
        
      case 'play':
        if (!message.listened_at) {
          updates.listened_at = new Date().toISOString();
        }
        break;
        
      case 'view':
        // viewed_at is handled by markMessageViewed
        break;
    }

    // Update additional timestamps if needed
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('messages')
        .update(updates)
        .eq('id', message.id);

      if (error) {
        console.error('[EphemeralMessage] Error updating message timestamps:', error);
      }
    }
  }

  /**
   * Check for expired messages with polling fallback
   * Similar to read receipts, real-time subscriptions are unreliable
   */
  static async checkExpiredMessages(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, expired')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .eq('expired', true);

      if (error) {
        console.error('[EphemeralMessage] Error checking expired messages:', error);
        return [];
      }

      return data?.map(msg => msg.id) || [];
    } catch (error) {
      console.error('[EphemeralMessage] Failed to check expired messages:', error);
      return [];
    }
  }

  /**
   * Start polling for message expiry updates (fallback for unreliable real-time)
   * Returns cleanup function
   */
  static startExpiryPolling(
    userId: string,
    callback: (expiredMessageIds: string[]) => void,
    intervalMs: number = 3000
  ): () => void {
    console.log('[EphemeralMessage] Starting expiry polling fallback...');
    
    let lastExpiredIds: string[] = [];
    
    const pollForExpired = async () => {
      try {
        const currentExpiredIds = await this.checkExpiredMessages(userId);
        
        // Find newly expired messages
        const newlyExpired = currentExpiredIds.filter(id => !lastExpiredIds.includes(id));
        
        if (newlyExpired.length > 0) {
          console.log(`[EphemeralMessage] Polling found ${newlyExpired.length} newly expired messages`);
          callback(newlyExpired);
        }
        
        lastExpiredIds = currentExpiredIds;
      } catch (error) {
        console.error('[EphemeralMessage] Error in expiry polling:', error);
      }
    };

    // Start polling
    const interval = setInterval(pollForExpired, intervalMs);

    // Return cleanup function
    return () => {
      console.log('[EphemeralMessage] Stopping expiry polling');
      clearInterval(interval);
    };
  }
}