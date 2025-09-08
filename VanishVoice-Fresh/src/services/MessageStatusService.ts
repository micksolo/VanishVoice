/**
 * MessageStatusService - Handles message status tracking and updates
 * 
 * This service manages the different states a message can be in:
 * - sending: Message is being sent
 * - sent: Message has been delivered to server
 * - delivered: Message has been received by recipient's device
 * - viewed: Message has been opened/viewed by recipient
 * - read: Alias for viewed (for compatibility)
 * - disappeared: Message has been auto-deleted after viewing
 */

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'viewed' | 'read' | 'disappeared';

export interface MessageStatusUpdate {
  messageId: string;
  status: MessageStatus;
  timestamp: Date;
  userId?: string;
}

export class MessageStatusService {
  private static statusOrder: Record<MessageStatus, number> = {
    'sending': 0,
    'sent': 1,
    'delivered': 2,
    'viewed': 3,
    'read': 3, // Same level as viewed
    'disappeared': 4,
  };
  
  private static pollingInterval?: NodeJS.Timeout;
  private static isPolling = false;

  /**
   * Updates the status of a message
   */
  static async updateMessageStatus(
    messageId: string, 
    newStatus: MessageStatus,
    userId?: string
  ): Promise<void> {
    const update: MessageStatusUpdate = {
      messageId,
      status: newStatus,
      timestamp: new Date(),
      userId,
    };

    // Here you would typically update the database
    // For now, just log the status change
    console.log('Message status update:', update);
  }

  /**
   * Determines if a status transition is valid
   */
  static isValidStatusTransition(currentStatus: MessageStatus, newStatus: MessageStatus): boolean {
    const currentOrder = this.statusOrder[currentStatus];
    const newOrder = this.statusOrder[newStatus];
    
    // Allow transitions to higher order statuses, or same level (read/viewed)
    return newOrder >= currentOrder;
  }

  /**
   * Gets the display icon for a message status
   */
  static getStatusIcon(status: MessageStatus): string {
    switch (status) {
      case 'sending':
        return 'time-outline';
      case 'sent':
        return 'checkmark';
      case 'delivered':
        return 'checkmark-done';
      case 'viewed':
      case 'read':
        return 'eye';
      case 'disappeared':
        return 'eye-off';
      default:
        return 'help-circle-outline';
    }
  }

  /**
   * Gets the display text for a message status
   */
  static getStatusText(status: MessageStatus): string {
    switch (status) {
      case 'sending':
        return 'Sending...';
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'viewed':
        return 'Viewed';
      case 'read':
        return 'Read';
      case 'disappeared':
        return 'Disappeared';
      default:
        return 'Unknown';
    }
  }

  /**
   * Checks if a status indicates the message has been seen by recipient
   */
  static isMessageSeen(status: MessageStatus): boolean {
    return status === 'viewed' || status === 'read';
  }

  /**
   * Checks if a status indicates the message is no longer available
   */
  static isMessageUnavailable(status: MessageStatus): boolean {
    return status === 'disappeared';
  }

  /**
   * Start polling for message status updates
   */
  static startStatusPolling(userId: string, friendId: string, intervalMs: number = 3000): void {
    if (this.isPolling) {
      console.log('[MessageStatusService] Status polling already active');
      return;
    }

    console.log(`[MessageStatusService] Starting status polling every ${intervalMs}ms for chat ${userId} <-> ${friendId}`);
    this.isPolling = true;

    this.pollingInterval = setInterval(async () => {
      try {
        // Poll for message status updates
        // In a real implementation, this would check for status changes
        // For now, just log that polling is active
        console.log('[MessageStatusService] Polling for status updates...');
      } catch (error) {
        console.error('[MessageStatusService] Error during status polling:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop status polling
   */
  static stopStatusPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    this.isPolling = false;
    console.log('[MessageStatusService] Status polling stopped');
  }

  /**
   * Check if status polling is active
   */
  static isStatusPollingActive(): boolean {
    return this.isPolling;
  }
}

export { MessageStatus };