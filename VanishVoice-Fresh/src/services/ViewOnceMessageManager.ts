import { ExpiryRule } from '../types/database';

/**
 * ViewOnceMessageManager - Handles view-once message logic
 * 
 * This service manages the behavior of messages that should only be viewed once
 * and then disappear or become inaccessible.
 */
export class ViewOnceMessageManager {
  /**
   * Determines if a given expiry rule represents a view-once message
   */
  static isViewOnceMessage(expiryRule: ExpiryRule): boolean {
    return expiryRule.type === 'view_once' || 
           (expiryRule.type === 'time' && expiryRule.duration_sec === 0);
  }

  /**
   * Checks if a view-once message should be marked as disappeared
   */
  static shouldMessageDisappear(expiryRule: ExpiryRule, hasBeenViewed: boolean): boolean {
    if (!this.isViewOnceMessage(expiryRule)) {
      return false;
    }
    return hasBeenViewed;
  }

  /**
   * Gets the display text for a view-once message status
   */
  static getStatusText(expiryRule: ExpiryRule, hasBeenViewed: boolean): string {
    if (!this.isViewOnceMessage(expiryRule)) {
      return '';
    }
    
    if (hasBeenViewed) {
      return 'Viewed once';
    } else {
      return 'View once';
    }
  }

  /**
   * Handles the logic when a view-once message is viewed
   */
  static async onMessageViewed(messageId: string, expiryRule: ExpiryRule): Promise<void> {
    if (!this.isViewOnceMessage(expiryRule)) {
      return;
    }

    // Here you would typically update the message status in your database
    // For example, mark it as viewed and set a flag for deletion
    console.log(`View-once message ${messageId} has been viewed`);
  }

  /**
   * Handle chat exit - clear any view-once messages that have been viewed
   */
  static async handleChatExit(friendId: string, userId: string): Promise<string[]> {
    try {
      console.log(`[ViewOnceMessageManager] Handling chat exit for user ${userId} with friend ${friendId}`);
      
      // Here you would find and clear view-once messages between these users
      // For now, return empty array as placeholder
      const clearedIds: string[] = [];
      
      // In a real implementation, this would:
      // 1. Find all view-once messages between userId and friendId that have been viewed
      // 2. Mark them for deletion/disappearance  
      // 3. Return the IDs of cleared messages
      
      console.log(`[ViewOnceMessageManager] Chat exit handled, cleared ${clearedIds.length} messages`);
      return clearedIds;
      
    } catch (error) {
      console.error('[ViewOnceMessageManager] Error handling chat exit:', error);
      return [];
    }
  }

  /**
   * Subscribe to message clearing events
   */
  static subscribeToMessageClearing(
    userId: string,
    friendId: string,
    callback: (clearedMessageIds: string[]) => void
  ): () => void {
    console.log(`[ViewOnceMessageManager] Setting up message clearing subscription for ${userId} <-> ${friendId}`);
    
    // In a real implementation, this would subscribe to real-time events
    // For now, return a cleanup function
    return () => {
      console.log(`[ViewOnceMessageManager] Cleaned up message clearing subscription for ${userId} <-> ${friendId}`);
    };
  }

  /**
   * Handle message consumption (when a message is viewed/consumed)
   */
  static async handleMessageConsumption(
    messageId: string,
    messageType: string,
    expiryRule: any
  ): Promise<void> {
    try {
      console.log(`[ViewOnceMessageManager] Handling consumption of ${messageType} message: ${messageId}`);
      
      if (this.isViewOnceMessage(expiryRule)) {
        console.log(`[ViewOnceMessageManager] Message ${messageId} is view-once, marking for cleanup`);
        
        // In a real implementation, this would:
        // 1. Mark the message as consumed
        // 2. Schedule it for deletion
        // 3. Update UI state
      } else {
        console.log(`[ViewOnceMessageManager] Message ${messageId} is not view-once, no cleanup needed`);
      }
      
    } catch (error) {
      console.error('[ViewOnceMessageManager] Error handling message consumption:', error);
    }
  }
}

export default ViewOnceMessageManager;