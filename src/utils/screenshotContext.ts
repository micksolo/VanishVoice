/**
 * Screenshot Context Detection Utilities
 * 
 * These utilities help identify which messages are visible when a screenshot
 * is taken, ensuring notifications go to the correct message owners.
 */

export interface VisibleMessage {
  id: string;
  senderId: string;
  recipientId: string;
  type: 'text' | 'voice' | 'video';
  timestamp: Date;
}

export interface ScreenshotContext {
  screenName: string;
  visibleMessages: VisibleMessage[];
  primaryMessageId?: string; // Most relevant message for notification
  friendId?: string;
  chatContext?: any;
}

/**
 * Determines which message should trigger a screenshot notification
 * 
 * Priority:
 * 1. Currently playing/viewing media message
 * 2. Most recent message from the other person
 * 3. Any visible message from the other person
 */
export function detectPrimaryMessageForScreenshot(
  visibleMessages: VisibleMessage[],
  currentUserId: string,
  currentlyViewingMessageId?: string
): VisibleMessage | null {
  
  // If user is currently viewing a specific message, prioritize that
  if (currentlyViewingMessageId) {
    const viewingMessage = visibleMessages.find(m => m.id === currentlyViewingMessageId);
    if (viewingMessage && viewingMessage.senderId !== currentUserId) {
      return viewingMessage;
    }
  }

  // Find all messages from other people (not the current user)
  const otherPersonMessages = visibleMessages.filter(m => m.senderId !== currentUserId);
  
  if (otherPersonMessages.length === 0) {
    return null; // No messages from other people to report
  }

  // Return the most recent message from other people
  return otherPersonMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
}

/**
 * Creates a comprehensive screenshot context for logging and notification
 */
export function createScreenshotContext(
  visibleMessages: VisibleMessage[],
  currentUserId: string,
  screenName: string,
  friendId?: string,
  currentlyViewingMessageId?: string
): ScreenshotContext {
  
  const primaryMessage = detectPrimaryMessageForScreenshot(
    visibleMessages,
    currentUserId,
    currentlyViewingMessageId
  );

  return {
    screenName,
    visibleMessages,
    primaryMessageId: primaryMessage?.id,
    friendId,
    chatContext: {
      totalVisibleMessages: visibleMessages.length,
      otherPersonMessages: visibleMessages.filter(m => m.senderId !== currentUserId).length,
      currentlyViewing: currentlyViewingMessageId,
      detectedAt: new Date().toISOString()
    }
  };
}

/**
 * Converts a message object to VisibleMessage format
 */
export function messageToVisibleMessage(message: any): VisibleMessage {
  return {
    id: message.id,
    senderId: message.sender_id || (message.isMine ? 'current_user' : 'other_user'),
    recipientId: message.recipient_id || '',
    type: message.type || 'text',
    timestamp: new Date(message.timestamp || message.created_at)
  };
}

/**
 * Logs screenshot context for debugging
 */
export function logScreenshotContext(context: ScreenshotContext, label: string = 'Screenshot') {
  console.log(`[${label}] Context:`, {
    screen: context.screenName,
    totalMessages: context.visibleMessages.length,
    primaryMessage: context.primaryMessageId,
    friendId: context.friendId,
    chatDetails: context.chatContext
  });
}