import { supabase } from '../services/supabase';
import ViewOnceMessageManager from '../services/ViewOnceMessageManager';
import { MessageStatus } from '../services/MessageStatusService';

/**
 * debugViewOnceClearing - Debug utilities for view-once message clearing
 * 
 * This utility provides debugging tools and status computation for view-once messages
 */

export interface MessageStatusInfo {
  messageId: string;
  status: MessageStatus;
  isViewOnce: boolean;
  hasBeenViewed: boolean;
  shouldDisappear: boolean;
  timeSinceViewed?: number;
}

/**
 * Computes the current status of a message for debugging purposes
 */
export const computeMessageStatus = (
  messageId: string,
  expiryRule: any,
  hasBeenViewed: boolean = false,
  viewedAt?: Date
): MessageStatusInfo => {
  const isViewOnce = ViewOnceMessageManager.isViewOnceMessage(expiryRule);
  const shouldDisappear = isViewOnce && hasBeenViewed;
  
  let status: MessageStatus = 'sent';
  
  if (shouldDisappear) {
    status = 'disappeared';
  } else if (hasBeenViewed) {
    status = 'viewed';
  }

  const info: MessageStatusInfo = {
    messageId,
    status,
    isViewOnce,
    hasBeenViewed,
    shouldDisappear,
  };

  if (viewedAt && hasBeenViewed) {
    info.timeSinceViewed = Date.now() - viewedAt.getTime();
  }

  return info;
};

/**
 * Debug function to log view-once message status
 */
export const debugViewOnceStatus = (messageInfo: MessageStatusInfo): void => {
  console.log(`[DEBUG] View-Once Message ${messageInfo.messageId}:`, {
    status: messageInfo.status,
    isViewOnce: messageInfo.isViewOnce,
    hasBeenViewed: messageInfo.hasBeenViewed,
    shouldDisappear: messageInfo.shouldDisappear,
    timeSinceViewed: messageInfo.timeSinceViewed ? `${messageInfo.timeSinceViewed}ms` : 'N/A',
  });
};

/**
 * Checks if a message should be cleared from the UI
 */
export const shouldClearFromUI = (
  expiryRule: any,
  hasBeenViewed: boolean,
  viewedAt?: Date,
  clearDelayMs: number = 5000
): boolean => {
  if (!ViewOnceMessageManager.isViewOnceMessage(expiryRule)) {
    return false;
  }

  if (!hasBeenViewed || !viewedAt) {
    return false;
  }

  const timeSinceViewed = Date.now() - viewedAt.getTime();
  return timeSinceViewed >= clearDelayMs;
};

/**
 * Gets debug information about all view-once messages for a user
 */
export const getViewOnceMessagesDebugInfo = async (userId: string): Promise<MessageStatusInfo[]> => {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .not('expiry_rule', 'is', null);

    if (error || !messages) {
      console.error('Error fetching messages for debug:', error);
      return [];
    }

    return messages
      .filter(msg => ViewOnceMessageManager.isViewOnceMessage(msg.expiry_rule))
      .map(msg => computeMessageStatus(
        msg.id,
        msg.expiry_rule,
        msg.has_been_viewed || false,
        msg.viewed_at ? new Date(msg.viewed_at) : undefined
      ));
  } catch (error) {
    console.error('Error in getViewOnceMessagesDebugInfo:', error);
    return [];
  }
};

/**
 * Force clears a view-once message (for debugging)
 */
export const forceClearViewOnceMessage = async (messageId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({
        has_been_viewed: true,
        viewed_at: new Date().toISOString(),
        status: 'disappeared'
      })
      .eq('id', messageId);

    if (error) {
      console.error('Error force clearing message:', error);
      return false;
    }

    console.log(`[DEBUG] Force cleared view-once message: ${messageId}`);
    return true;
  } catch (error) {
    console.error('Error in forceClearViewOnceMessage:', error);
    return false;
  }
};

export default {
  computeMessageStatus,
  debugViewOnceStatus,
  shouldClearFromUI,
  getViewOnceMessagesDebugInfo,
  forceClearViewOnceMessage,
};