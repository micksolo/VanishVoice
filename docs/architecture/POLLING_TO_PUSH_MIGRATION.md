# Migration Guide: From Polling to Push Notifications

## Current State
- **Polling Every 3-30 seconds**: Works but won't scale
- **10K users = 200K+ queries/minute**: Unsustainable
- **Battery drain**: Constant wake-ups

## Target State
- **Push-driven updates**: Instant, scalable
- **Zero polling when backgrounded**: Battery efficient
- **Minimal polling when active**: Only for recovery

## Migration Phases

### Phase 1: Implement Push Infrastructure ✅
**Status**: Basic implementation complete

1. **Edge Function Created**: `send-push-notification`
2. **Push tokens saved**: Already collecting tokens
3. **Basic integration**: Messages trigger push

### Phase 2: Reduce Polling Gradually
```typescript
// Before: Poll every 3-30 seconds
// After: Only poll when app becomes active

useFocusEffect(() => {
  // Load once when screen focuses
  loadFriends();
  
  // No continuous polling
  // Push notifications handle updates
});
```

### Phase 3: Smart Recovery Polling
```typescript
// Only poll if we suspect missed notifications
let lastNotificationTime = Date.now();

// Check if we might have missed notifications
const checkMissedMessages = () => {
  const timeSinceLastNotification = Date.now() - lastNotificationTime;
  
  // Only poll if it's been > 5 minutes
  if (timeSinceLastNotification > 5 * 60 * 1000) {
    updateUnreadCounts();
  }
};
```

### Phase 4: WebSocket for Active Users
- Keep WebSocket for users actively in chat
- Instant delivery while chatting
- Fall back to push when inactive

## Implementation Checklist

### Backend
- [x] Create push notification Edge Function
- [ ] Add database trigger for new messages
- [ ] Implement notification queue for reliability
- [ ] Add push delivery tracking

### Frontend
- [x] Save push tokens
- [x] Send push on new message
- [ ] Remove aggressive polling
- [ ] Handle push notification taps
- [ ] Update UI from push data
- [ ] Add "pull to refresh" instead of auto-poll

### Database
- [ ] Add notification_sent flag to messages
- [ ] Track push delivery status
- [ ] Clean up old push tokens

## Monitoring & Rollback Plan

### Metrics to Track
1. **Push delivery rate**: Should be >95%
2. **Message delivery latency**: <2 seconds
3. **Database read operations**: Should drop 90%+
4. **User complaints**: Monitor for missed messages

### Rollback Triggers
- Push delivery rate <90%
- User reports of missed messages
- Increased support tickets

### Gradual Rollout
1. **Test group**: 1% of users
2. **Monitor for 1 week**
3. **Expand to 10%**
4. **Full rollout after 2 weeks**

## Code Changes Needed

### 1. Update FriendsListScreen
```typescript
// Remove continuous polling
// Add pull-to-refresh
// Update counts from push events
```

### 2. Add Notification Handler
```typescript
// Handle foreground notifications
// Update UI without polling
// Navigate on tap
```

### 3. Database Trigger
```sql
-- Trigger push on new message
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://your-project.functions.supabase.co/send-push-notification',
    body := json_build_object(
      'recipient_id', NEW.recipient_id,
      'title', 'New Message',
      'body', 'You have a new message'
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();
```

## Testing Plan
1. Test push delivery in all app states
2. Test with poor network conditions
3. Test with high message volume
4. Test battery impact
5. Test notification permissions

## Success Criteria
- 90% reduction in database reads
- <2 second message delivery
- No increase in missed messages
- Positive user feedback on battery life