// Enhanced event system for message clearing events
class MessageClearingService {
  private static instance: MessageClearingService;
  private listeners: Set<(data?: any) => void> = new Set();
  private isClearing: boolean = false;

  private constructor() {}

  static getInstance(): MessageClearingService {
    if (!MessageClearingService.instance) {
      MessageClearingService.instance = new MessageClearingService();
    }
    return MessageClearingService.instance;
  }

  // Emit an event when all messages are cleared
  notifyMessagesCleared(data?: { deletedCount?: number; userId?: string }) {
    console.log('[MessageClearingService] Notifying all listeners that messages were cleared', data);
    
    this.isClearing = true;
    
    let notifiedCount = 0;
    let errorCount = 0;
    
    this.listeners.forEach(callback => {
      try {
        callback(data);
        notifiedCount++;
      } catch (error) {
        errorCount++;
        console.error('[MessageClearingService] Error in listener:', error);
      }
    });
    
    console.log(`[MessageClearingService] Notified ${notifiedCount} listeners, ${errorCount} errors`);
    
    // Reset clearing flag after a delay to allow UI updates
    setTimeout(() => {
      this.isClearing = false;
    }, 1000);
  }

  // Subscribe to message clearing events
  subscribeToMessageClearing(callback: (data?: any) => void): () => void {
    if (typeof callback !== 'function') {
      console.error('[MessageClearingService] Callback must be a function');
      return () => {};
    }
    
    this.listeners.add(callback);
    console.log(`[MessageClearingService] Added listener, total: ${this.listeners.size}`);
    
    return () => {
      const deleted = this.listeners.delete(callback);
      console.log(`[MessageClearingService] Removed listener: ${deleted}, remaining: ${this.listeners.size}`);
    };
  }

  // Get current state
  getState() {
    return {
      isClearing: this.isClearing,
      listenerCount: this.listeners.size
    };
  }

  // Check if currently clearing (can be used to prevent re-fetching during clear operation)
  isCurrentlyClearing(): boolean {
    return this.isClearing;
  }

  // Clear all listeners (useful for cleanup during app restart)
  clearAllListeners() {
    const count = this.listeners.size;
    this.listeners.clear();
    console.log(`[MessageClearingService] Cleared ${count} listeners`);
  }
}

export default MessageClearingService.getInstance();