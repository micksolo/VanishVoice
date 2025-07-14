# Scalable Messaging Architecture

## Current Issues with Polling
- **Load**: Each user polls every 3-30 seconds
- **Scale**: 10K users = 200K+ queries/minute
- **Cost**: High database read costs
- **Battery**: Constant polling drains mobile devices

## Recommended Architecture for Scale

### Option 1: Push Notifications (Recommended)
**How it works:**
1. When user sends message, trigger Edge Function
2. Edge Function sends push notification to recipient
3. App updates UI when notification received
4. No polling needed - completely event-driven

**Implementation:**
```typescript
// Edge Function: on-new-message
export async function onNewMessage(message: Message) {
  // Get recipient's push token
  const { data: recipient } = await supabase
    .from('users')
    .select('push_token')
    .eq('id', message.recipient_id)
    .single();
    
  // Send push notification
  await sendPushNotification({
    to: recipient.push_token,
    title: 'New Message',
    body: 'You have a new message',
    data: { 
      type: 'new_message',
      sender_id: message.sender_id,
      message_id: message.id
    }
  });
}
```

**Benefits:**
- Zero polling required
- Instant delivery
- Scales to millions of users
- Battery efficient
- Works when app is backgrounded

### Option 2: Hybrid WebSocket + Push
**How it works:**
1. WebSocket for users currently in app
2. Push notifications for background users
3. Fallback to push if WebSocket fails

**Benefits:**
- Real-time for active users
- Push ensures delivery
- Best user experience

### Option 3: Message Queue Pattern
**How it works:**
1. Write messages to user-specific queue
2. Client checks queue on app open/focus
3. Clear queue after reading

**Database Schema:**
```sql
CREATE TABLE message_queue (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  message_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX idx_queue_user_created 
ON message_queue(user_id, created_at DESC);

-- Auto-cleanup old messages
CREATE POLICY "Delete old queue items" 
ON message_queue 
FOR DELETE 
USING (created_at < NOW() - INTERVAL '7 days');
```

### Option 4: Smart Caching with ETags
**How it works:**
1. Server tracks last change timestamp per user
2. Client sends last known timestamp
3. Server returns 304 Not Modified if no changes
4. Reduces data transfer by 90%+

**Implementation:**
```typescript
// API endpoint
async function getUnreadCounts(userId: string, lastCheck: string) {
  const lastChange = await redis.get(`last_change:${userId}`);
  
  if (lastChange === lastCheck) {
    return { status: 304 }; // Not Modified
  }
  
  const counts = await getUnreadCountsFromDB(userId);
  return { 
    counts, 
    etag: lastChange,
    status: 200 
  };
}
```

## Recommended Implementation Plan

### Phase 1: Push Notifications (Quick Win)
1. Implement push for new messages
2. Remove polling when app is backgrounded
3. Keep minimal polling only when app is active

### Phase 2: Optimize Active Polling
1. Implement ETag/Last-Modified checks
2. Batch requests for multiple users
3. Use exponential backoff

### Phase 3: WebSocket Recovery
1. Fix WebSocket issues for active users
2. Use push as fallback
3. Monitor and optimize

## Cost Analysis

### Current (Polling)
- 10K users × 20 polls/min = 200K reads/min
- Monthly: ~8.6 billion reads
- Supabase cost: ~$430/month

### With Push Notifications
- 10K users × 50 messages/day = 500K pushes/day
- Monthly: ~15M operations
- Cost: ~$15/month (99% reduction)

## Performance Metrics to Track
1. Push delivery success rate
2. Message delivery latency
3. Battery usage impact
4. Database read operations
5. User engagement rates

## Migration Strategy
1. Implement push notifications first
2. Keep polling as fallback
3. Gradually reduce polling frequency
4. Monitor metrics
5. Remove polling once push is stable