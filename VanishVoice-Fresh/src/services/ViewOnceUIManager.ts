import { supabase } from './supabase';
import ViewOnceMessageManager from './ViewOnceMessageManager';
import { MessageStatusService, MessageStatus } from './MessageStatusService';
import ViewOnceClearingDebugger from '../utils/ViewOnceClearingDebugger';

/**
 * ViewOnceUIManager - Manages UI state and behavior for view-once messages
 * 
 * This service handles:
 * - UI state management for view-once messages
 * - Message disappearing animations and timing
 * - User interaction handling for view-once content
 * - Integration with clearing debugger
 */

export interface ViewOnceUIState {
  messageId: string;
  isVisible: boolean;
  isViewing: boolean;
  hasBeenViewed: boolean;
  shouldDisappear: boolean;
  disappearanceTimer?: NodeJS.Timeout;
  viewedAt?: Date;
}

export class ViewOnceUIManager {
  private static instance: ViewOnceUIManager;
  private messageStates = new Map<string, ViewOnceUIState>();
  private clearDelayMs = 3000; // Default 3 seconds after viewing
  private debugger = ViewOnceClearingDebugger;

  private constructor() {}

  static getInstance(): ViewOnceUIManager {
    if (!ViewOnceUIManager.instance) {
      ViewOnceUIManager.instance = new ViewOnceUIManager();
    }
    return ViewOnceUIManager.instance;
  }

  /**
   * Set the delay before a viewed message disappears from UI
   */
  setClearDelay(delayMs: number): void {
    this.clearDelayMs = delayMs;
  }

  /**
   * Register a chat screen with the UI manager
   */
  registerChatScreen(chatId: string, userId: string, friendId: string): void {
    console.log(`[ViewOnceUIManager] Registering chat screen: ${chatId}`);
    console.log(`[ViewOnceUIManager] Participants: ${userId} <-> ${friendId}`);
    
    // In a real implementation, this would:
    // 1. Set up UI state tracking for this specific chat
    // 2. Initialize message visibility states
    // 3. Set up cleanup handlers for when chat is closed
    
    // For now, just log the registration
  }

  /**
   * Unregister a chat screen
   */
  unregisterChatScreen(chatId: string): void {
    console.log(`[ViewOnceUIManager] Unregistering chat screen: ${chatId}`);
    
    // Clean up any timers or state for this chat
    // In a real implementation, this would clean up message states
  }

  /**
   * Initialize a view-once message in the UI
   */
  initializeMessage(
    messageId: string,
    expiryRule: any,
    hasBeenViewed: boolean = false,
    viewedAt?: Date
  ): ViewOnceUIState {
    const isViewOnce = ViewOnceMessageManager.isViewOnceMessage(expiryRule);
    
    const state: ViewOnceUIState = {
      messageId,
      isVisible: !hasBeenViewed || !isViewOnce,
      isViewing: false,
      hasBeenViewed,
      shouldDisappear: isViewOnce && hasBeenViewed,
      viewedAt,
    };

    this.messageStates.set(messageId, state);

    // Track in debugger
    this.debugger.trackMessage(messageId, expiryRule, hasBeenViewed, viewedAt);

    // If already viewed, start disappearance timer
    if (state.shouldDisappear && viewedAt) {
      this.startDisappearanceTimer(messageId);
    }

    return state;
  }

  /**
   * Mark a message as being viewed (user tapped to open)
   */
  async markAsViewed(messageId: string): Promise<boolean> {
    const state = this.messageStates.get(messageId);
    if (!state || state.hasBeenViewed) {
      return false;
    }

    const viewedAt = new Date();

    // Update local state
    const updatedState: ViewOnceUIState = {
      ...state,
      isViewing: true,
      hasBeenViewed: true,
      shouldDisappear: true,
      viewedAt,
    };

    this.messageStates.set(messageId, updatedState);

    // Update debugger
    this.debugger.markMessageAsViewed(messageId);

    try {
      // Update database
      const { error } = await supabase
        .from('messages')
        .update({
          has_been_viewed: true,
          viewed_at: viewedAt.toISOString(),
          status: 'viewed',
        })
        .eq('id', messageId);

      if (error) {
        console.error('Error updating message viewed status:', error);
        return false;
      }

      // Update message status service
      await MessageStatusService.updateMessageStatus(messageId, 'viewed');

      // Start disappearance timer
      this.startDisappearanceTimer(messageId);

      return true;
    } catch (error) {
      console.error('Error in markAsViewed:', error);
      return false;
    }
  }

  /**
   * Start the timer to disappear a message after viewing
   */
  private startDisappearanceTimer(messageId: string): void {
    const state = this.messageStates.get(messageId);
    if (!state || !state.hasBeenViewed || !state.viewedAt) {
      return;
    }

    // Clear existing timer
    if (state.disappearanceTimer) {
      clearTimeout(state.disappearanceTimer);
    }

    const timeAlreadyElapsed = Date.now() - state.viewedAt.getTime();
    const remainingTime = Math.max(0, this.clearDelayMs - timeAlreadyElapsed);

    const timer = setTimeout(() => {
      this.makeMessageDisappear(messageId);
    }, remainingTime);

    // Update state with timer
    this.messageStates.set(messageId, {
      ...state,
      disappearanceTimer: timer,
    });
  }

  /**
   * Make a message disappear from the UI
   */
  private async makeMessageDisappear(messageId: string): Promise<void> {
    const state = this.messageStates.get(messageId);
    if (!state) return;

    // Update local state
    this.messageStates.set(messageId, {
      ...state,
      isVisible: false,
      isViewing: false,
      shouldDisappear: true,
      disappearanceTimer: undefined,
    });

    try {
      // Update database status
      await supabase
        .from('messages')
        .update({ status: 'disappeared' })
        .eq('id', messageId);

      // Update message status service
      await MessageStatusService.updateMessageStatus(messageId, 'disappeared');

      console.log(`View-once message ${messageId} has disappeared from UI`);
    } catch (error) {
      console.error('Error updating disappeared status:', error);
    }
  }

  /**
   * Get the current UI state for a message
   */
  getMessageState(messageId: string): ViewOnceUIState | undefined {
    return this.messageStates.get(messageId);
  }

  /**
   * Check if a message should be visible in the UI
   */
  shouldShowMessage(messageId: string): boolean {
    const state = this.messageStates.get(messageId);
    if (!state) return true; // Default to visible if not tracked

    return state.isVisible;
  }

  /**
   * Force hide a message (for testing/debugging)
   */
  forceHideMessage(messageId: string): void {
    const state = this.messageStates.get(messageId);
    if (state) {
      if (state.disappearanceTimer) {
        clearTimeout(state.disappearanceTimer);
      }
      
      this.messageStates.set(messageId, {
        ...state,
        isVisible: false,
        isViewing: false,
        disappearanceTimer: undefined,
      });
    }
  }

  /**
   * Clean up state for a message (when chat is closed, etc.)
   */
  cleanupMessage(messageId: string): void {
    const state = this.messageStates.get(messageId);
    if (state?.disappearanceTimer) {
      clearTimeout(state.disappearanceTimer);
    }
    
    this.messageStates.delete(messageId);
    this.debugger.removeMessage(messageId);
  }

  /**
   * Clean up all message states
   */
  cleanupAll(): void {
    this.messageStates.forEach((state) => {
      if (state.disappearanceTimer) {
        clearTimeout(state.disappearanceTimer);
      }
    });
    
    this.messageStates.clear();
    this.debugger.clearTracking();
  }

  /**
   * Get summary of all managed messages
   */
  getSummary(): {
    total: number;
    visible: number;
    viewed: number;
    disappeared: number;
  } {
    const states = Array.from(this.messageStates.values());
    
    return {
      total: states.length,
      visible: states.filter(s => s.isVisible).length,
      viewed: states.filter(s => s.hasBeenViewed).length,
      disappeared: states.filter(s => s.shouldDisappear && !s.isVisible).length,
    };
  }
}

// Export singleton instance
export default ViewOnceUIManager.getInstance();