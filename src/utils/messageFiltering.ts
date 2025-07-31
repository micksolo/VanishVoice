import { Message as DBMessage } from '../types/database';

/**
 * Utility functions for filtering expired ephemeral messages
 * This ensures consistent filtering across all message loading operations
 */

/**
 * Check if a database message should be filtered out due to expiry
 */
export function shouldFilterExpiredMessage(msg: DBMessage): boolean {
  // Skip hard-expired messages 
  if (msg.expired) {
    console.log('[MessageFilter] Filtering hard-expired message:', msg.id);
    return true;
  }
  
  // Skip view-once messages that have been viewed
  if (msg.expiry_rule?.type === 'view' && msg.viewed_at) {
    console.log('[MessageFilter] Filtering viewed view-once message:', msg.id);
    return true;
  }
  
  // Skip read-once messages that have been read
  if (msg.expiry_rule?.type === 'read' && msg.read_at) {
    console.log('[MessageFilter] Filtering read read-once message:', msg.id);
    return true;
  }
  
  // Skip playback-once messages that have been listened to
  if (msg.expiry_rule?.type === 'playback' && msg.listened_at) {
    console.log('[MessageFilter] Filtering played playback-once message:', msg.id);
    return true;
  }
  
  // For time-based messages: DON'T filter immediately - let countdown timers show
  // Only filter if explicitly marked as expired in database or if grace period has passed
  if (msg.expiry_rule?.type === 'time') {
    const now = new Date();
    const createdAt = new Date(msg.created_at);
    const expiryTime = new Date(createdAt.getTime() + (msg.expiry_rule.duration_sec * 1000));
    
    // Give a small grace period (5 seconds) after expiry to allow UI animations
    const gracePeriod = 5000; // 5 seconds
    const graceTime = new Date(expiryTime.getTime() + gracePeriod);
    
    if (now > graceTime) {
      console.log('[MessageFilter] Filtering time-expired message after grace period:', msg.id);
      return true;
    }
  }
  
  return false;
}

/**
 * Filter an array of database messages to remove expired ones
 */
export function filterExpiredMessages(messages: DBMessage[]): DBMessage[] {
  // Ensure we always return an array, even if input is null/undefined
  if (!messages || !Array.isArray(messages)) {
    console.warn('[MessageFilter] filterExpiredMessages received invalid input:', messages);
    return [];
  }
  
  return messages.filter(msg => !shouldFilterExpiredMessage(msg));
}

/**
 * Get a consistent database query filter for non-expired messages
 * This can be used in Supabase queries to filter at the database level
 */
export function getNonExpiredMessageFilter() {
  return 'and(is_expired.is.null,expired.is.null)';
}

/**
 * Check if two message arrays are equivalent (same IDs in same order)
 * Used to prevent unnecessary UI updates when polling detects no real changes
 */
export function areMessageArraysEquivalent(arr1: Array<{id: string}>, arr2: Array<{id: string}>): boolean {
  if (arr1.length !== arr2.length) return false;
  
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i].id !== arr2[i].id) return false;
  }
  
  return true;
}