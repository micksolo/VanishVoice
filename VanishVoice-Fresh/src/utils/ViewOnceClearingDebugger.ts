import { supabase } from '../services/supabase';
import ViewOnceMessageManager from '../services/ViewOnceMessageManager';
import { computeMessageStatus, debugViewOnceStatus, MessageStatusInfo } from './debugViewOnceClearing';

/**
 * ViewOnceClearingDebugger - Advanced debugging tools for view-once message clearing
 * 
 * This class provides comprehensive debugging capabilities for view-once message lifecycle
 */

export class ViewOnceClearingDebugger {
  private static instance: ViewOnceClearingDebugger;
  private debugMode: boolean = false;
  private messageStatusCache = new Map<string, MessageStatusInfo>();

  private constructor() {}

  static getInstance(): ViewOnceClearingDebugger {
    if (!ViewOnceClearingDebugger.instance) {
      ViewOnceClearingDebugger.instance = new ViewOnceClearingDebugger();
    }
    return ViewOnceClearingDebugger.instance;
  }

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(`[ViewOnceClearingDebugger] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Log debug message if debug mode is enabled
   */
  private log(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[ViewOnceClearingDebugger] ${message}`, data || '');
    }
  }

  /**
   * Track a message's view-once status
   */
  trackMessage(messageId: string, expiryRule: any, hasBeenViewed: boolean = false, viewedAt?: Date): void {
    const status = computeMessageStatus(messageId, expiryRule, hasBeenViewed, viewedAt);
    this.messageStatusCache.set(messageId, status);
    
    this.log(`Tracking message ${messageId}`, status);
    
    if (this.debugMode) {
      debugViewOnceStatus(status);
    }
  }

  /**
   * Update message status when viewed
   */
  markMessageAsViewed(messageId: string): void {
    const cached = this.messageStatusCache.get(messageId);
    if (cached) {
      const updatedStatus: MessageStatusInfo = {
        ...cached,
        hasBeenViewed: true,
        status: cached.isViewOnce ? 'viewed' : cached.status,
        shouldDisappear: cached.isViewOnce,
        timeSinceViewed: 0,
      };
      
      this.messageStatusCache.set(messageId, updatedStatus);
      this.log(`Message ${messageId} marked as viewed`, updatedStatus);
      
      if (this.debugMode) {
        debugViewOnceStatus(updatedStatus);
      }
    }
  }

  /**
   * Check if message should disappear and update status
   */
  checkShouldDisappear(messageId: string, clearDelayMs: number = 5000): boolean {
    const cached = this.messageStatusCache.get(messageId);
    if (!cached || !cached.isViewOnce || !cached.hasBeenViewed) {
      return false;
    }

    const currentTime = Date.now();
    const timeSinceViewed = cached.timeSinceViewed || 0;
    const shouldDisappear = timeSinceViewed >= clearDelayMs;

    if (shouldDisappear && cached.status !== 'disappeared') {
      const updatedStatus: MessageStatusInfo = {
        ...cached,
        status: 'disappeared',
        shouldDisappear: true,
      };
      
      this.messageStatusCache.set(messageId, updatedStatus);
      this.log(`Message ${messageId} should disappear`, updatedStatus);
    }

    return shouldDisappear;
  }

  /**
   * Get all tracked messages
   */
  getTrackedMessages(): Map<string, MessageStatusInfo> {
    return new Map(this.messageStatusCache);
  }

  /**
   * Get specific message status
   */
  getMessageStatus(messageId: string): MessageStatusInfo | undefined {
    return this.messageStatusCache.get(messageId);
  }

  /**
   * Clear all tracked messages
   */
  clearTracking(): void {
    this.messageStatusCache.clear();
    this.log('Cleared all message tracking');
  }

  /**
   * Remove specific message from tracking
   */
  removeMessage(messageId: string): void {
    this.messageStatusCache.delete(messageId);
    this.log(`Removed message ${messageId} from tracking`);
  }

  /**
   * Get summary of all tracked view-once messages
   */
  getSummary(): { total: number; viewed: number; disappeared: number; pending: number } {
    const messages = Array.from(this.messageStatusCache.values());
    const viewOnceMessages = messages.filter(msg => msg.isViewOnce);
    
    const summary = {
      total: viewOnceMessages.length,
      viewed: viewOnceMessages.filter(msg => msg.hasBeenViewed && msg.status === 'viewed').length,
      disappeared: viewOnceMessages.filter(msg => msg.status === 'disappeared').length,
      pending: viewOnceMessages.filter(msg => !msg.hasBeenViewed).length,
    };

    this.log('Summary of tracked view-once messages', summary);
    return summary;
  }

  /**
   * Export debug data for analysis
   */
  exportDebugData(): string {
    const data = {
      debugMode: this.debugMode,
      timestamp: new Date().toISOString(),
      messages: Array.from(this.messageStatusCache.entries()),
      summary: this.getSummary(),
    };

    return JSON.stringify(data, null, 2);
  }
}

// Export singleton instance
export default ViewOnceClearingDebugger.getInstance();