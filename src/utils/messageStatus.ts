import { Message } from '../types/database';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Compute the status of a message based on database fields
 * 
 * Status Logic:
 * - sending: Message is being sent (not in DB yet)
 * - sent: Message exists in DB but recipient hasn't received it
 * - delivered: Message has been received by recipient but not viewed/read
 * - read: Message has been viewed/read by recipient
 * - failed: Message failed to send (not implemented yet)
 */
export function computeMessageStatus(
  message: Message,
  currentUserId: string
): MessageStatus {
  // For messages we received from others, status doesn't apply
  if (message.sender_id !== currentUserId) {
    return 'delivered';
  }

  // For messages we sent, determine status based on recipient interaction
  
  // If the message has been read (text message with read_at set)
  if (message.type === 'text' && message.read_at) {
    return 'read';
  }
  
  // If the message has been viewed (any message type with viewed_at set)
  if (message.viewed_at) {
    return 'read';
  }
  
  // If the message has been listened to (voice/video with listened_at set)
  if ((message.type === 'voice' || message.type === 'video') && message.listened_at) {
    return 'read';
  }
  
  // Message exists in database but hasn't been interacted with yet
  // For now, we assume all messages in DB are delivered
  // In the future, this could be enhanced with delivery confirmations
  return 'delivered';
}

/**
 * Determine if a message has been read/viewed by the recipient
 * This is used for UI updates and real-time tracking
 */
export function isMessageRead(message: Message): boolean {
  // Text messages: check read_at
  if (message.type === 'text') {
    return message.read_at != null;
  }
  
  // Voice/video messages: check listened_at
  if (message.type === 'voice' || message.type === 'video') {
    return message.listened_at != null;
  }
  
  // Fallback to viewed_at for any message type
  return message.viewed_at != null;
}

/**
 * Get the timestamp when a message was read/viewed
 */
export function getReadTimestamp(message: Message): Date | null {
  // Text messages: prefer read_at
  if (message.type === 'text' && message.read_at) {
    return new Date(message.read_at);
  }
  
  // Voice/video messages: prefer listened_at
  if ((message.type === 'voice' || message.type === 'video') && message.listened_at) {
    return new Date(message.listened_at);
  }
  
  // Fallback to viewed_at
  if (message.viewed_at) {
    return new Date(message.viewed_at);
  }
  
  return null;
}