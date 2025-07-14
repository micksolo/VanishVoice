# Database Optimization for Message Detection

## Current Performance Issues

1. **Frequent Polling**: System polls every 3-30 seconds
2. **Multiple Queries**: Loading friends and messages separately
3. **No Proper Indexes**: Missing indexes for efficient message queries

## Recommended Database Indexes

Add these indexes to improve query performance:

```sql
-- Index for efficient unread message queries
CREATE INDEX idx_messages_recipient_unread 
ON messages(recipient_id, read_at) 
WHERE read_at IS NULL;

-- Composite index for sender-recipient queries
CREATE INDEX idx_messages_sender_recipient_read 
ON messages(sender_id, recipient_id, read_at);

-- Index for message ordering
CREATE INDEX idx_messages_created_at 
ON messages(created_at DESC);

-- Index for friend lookups
CREATE INDEX idx_friends_user_id 
ON friends(user_id);
```

## Query Optimization Implemented

### Before (N+1 Problem):
- 1 query to get friends
- N queries to get unread count for each friend
- Total: 11 queries for 10 friends

### After (Optimized):
- 1 query to get friends with user data
- 1 query to get all unread messages
- Total: 2 queries regardless of friend count

## Adaptive Polling Strategy

The system now uses adaptive polling:
- **Active Period**: Polls every 3 seconds when new messages arrive
- **Idle Period**: Gradually increases to 30 seconds when no activity
- **Smart Detection**: Uses message ID checksums to detect changes
- **Efficiency**: Reduces server load by 90% during idle periods

## Additional Optimizations

1. **Limit Query Results**: Cap unread messages at 100 to prevent huge queries
2. **Select Only Required Fields**: Only fetch `sender_id` and `id` for counting
3. **Batch Operations**: Use Promise.all() for parallel queries
4. **Single Query for Counts**: Get all unread counts in one database call

## WebSocket Investigation Needed

Real-time subscriptions aren't firing properly. Investigate:
- Supabase WebSocket configuration
- Network/firewall restrictions
- Expo Go limitations with WebSockets
- Consider upgrading to development build for better WebSocket support

## Monitoring

Add these metrics to track performance:
- Average query time for unread counts
- Number of polls per minute
- WebSocket connection success rate
- Battery usage with adaptive polling