import { Message } from '../types/database';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Get a user-friendly description of the message status
 */
export function getStatusDescription(status: MessageStatus): string {
  switch (status) {
    case 'sending': return 'Sending...';
    case 'sent': return 'Sent';
    case 'delivered': return 'Delivered';
    case 'read': return 'Read';
    case 'failed': return 'Failed to send';
    default: return 'Unknown status';
  }
}

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
  console.log(`[MessageStatus] 🔍 Computing status for message ${message.id}`);
  console.log(`[MessageStatus] 📋 Message details:`, {
    id: message.id,
    type: message.type,
    sender_id: message.sender_id,
    recipient_id: message.recipient_id,
    read_at: message.read_at || 'null',
    viewed_at: message.viewed_at || 'null',
    listened_at: message.listened_at || 'null',
    created_at: message.created_at
  });
  console.log(`[MessageStatus] 👤 Current user: ${currentUserId}, Message sender: ${message.sender_id}`);
  
  // For messages we received from others, status doesn't apply to sender UI
  if (message.sender_id !== currentUserId) {
    console.log(`[MessageStatus] ↩️ Message from others - returning 'delivered'`);
    return 'delivered';
  }

  console.log(`[MessageStatus] 📤 Message sent by us - checking recipient interaction...`);
  // For messages we sent, determine status based on recipient interaction
  
  // Check if message has been read/viewed/listened to in priority order
  
  // Text messages: check read_at timestamp
  if (message.type === 'text') {
    console.log(`[MessageStatus] Text message ${message.id} - checking read_at:`, message.read_at);
    if (message.read_at) {
      console.log(`[MessageStatus] ✅ Message ${message.id} marked as READ - has read_at:`, message.read_at);
      return 'read';
    } else {
      console.log(`[MessageStatus] ❌ Message ${message.id} NOT read - read_at is null/undefined`);
    }
  }
  
  // Voice/video messages: check listened_at timestamp (primary indicator)
  if ((message.type === 'voice' || message.type === 'video') && message.listened_at) {
    console.log(`[MessageStatus] Message ${message.id} marked as READ - has listened_at:`, message.listened_at);
    return 'read';
  }
  
  // Fallback: check viewed_at for any message type
  if (message.viewed_at) {
    console.log(`[MessageStatus] Message ${message.id} marked as READ - has viewed_at:`, message.viewed_at);
    return 'read';
  }
  
  // Check if message has been delivered (received by recipient device)
  // We'll use created_at timestamp + a reasonable delay as proxy for delivery
  // In a real production app, this would be based on actual delivery confirmations
  const messageAge = Date.now() - new Date(message.created_at).getTime();
  const DELIVERY_DELAY_MS = 2000; // 2 seconds - reasonable time for message to be delivered
  
  if (messageAge > DELIVERY_DELAY_MS) {
    console.log(`[MessageStatus] Message ${message.id} status: DELIVERED (age: ${messageAge}ms)`);
    return 'delivered';
  }
  
  // Message was just sent, still in transit
  console.log(`[MessageStatus] Message ${message.id} status: SENT (age: ${messageAge}ms)`);
  return 'sent';
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
 * Determine if a message has been delivered to the recipient device
 * This is used for showing double gray ticks before message is read
 */
export function isMessageDelivered(message: Message): boolean {
  const messageAge = Date.now() - new Date(message.created_at).getTime();
  const DELIVERY_DELAY_MS = 2000; // 2 seconds
  return messageAge > DELIVERY_DELAY_MS;
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

/**
 * Get the estimated timestamp when a message was delivered
 */
export function getDeliveredTimestamp(message: Message): Date | null {
  const messageAge = Date.now() - new Date(message.created_at).getTime();
  const DELIVERY_DELAY_MS = 2000;
  
  if (messageAge > DELIVERY_DELAY_MS) {
    // Return estimated delivery time (created_at + delay)
    return new Date(new Date(message.created_at).getTime() + DELIVERY_DELAY_MS);
  }
  
  return null;
}