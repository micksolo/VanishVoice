# Realtime WebSocket Troubleshooting Guide

## Current Issue
Real-time subscriptions are connecting (showing SUBSCRIBED status) but not receiving database change events.

## Common Causes & Solutions

### 1. **Supabase Dashboard Configuration**
- **Check**: Realtime must be enabled for the `messages` table in Supabase dashboard
- **Fix**: 
  1. Go to Supabase Dashboard → Database → Replication
  2. Enable replication for `messages` table
  3. Select which events to replicate (INSERT, UPDATE, DELETE)

### 2. **Row Level Security (RLS) Policies**
- **Issue**: RLS policies might be blocking realtime events
- **Check**: Ensure RLS policies allow SELECT on messages table
- **Fix**: Add policy for realtime access:
```sql
CREATE POLICY "Users can view their own messages realtime" 
ON messages FOR SELECT 
USING (auth.uid() = recipient_id OR auth.uid() = sender_id);
```

### 3. **Expo Go Limitations**
- **Issue**: Expo Go has WebSocket limitations, especially on physical devices
- **Symptoms**: Works in simulator but not on device
- **Fix**: Use development build instead of Expo Go:
```bash
npx expo run:ios
# or
npx expo run:android
```

### 4. **Network/Firewall Issues**
- **Issue**: Corporate networks or firewalls blocking WebSocket connections
- **Check**: Test on different network (mobile data vs WiFi)
- **Fix**: Use polling as fallback (already implemented)

### 5. **Filter Syntax Issues**
- **Current Filter**: `recipient_id=eq.${user.id}`
- **Alternative Syntax**: Try without template literals
- **Test**: Subscribe without filters first, then add filters

### 6. **Channel Naming Conflicts**
- **Issue**: Multiple subscriptions to same channel name
- **Fix**: Use unique channel names per subscription

## Debugging Steps

1. **Enable Realtime Debugger**
   - Look for red bug button (🐛) in Friends screen
   - Run "Check Config" to verify setup
   - Run "Test Connection" to test WebSocket

2. **Check Supabase Logs**
   - Dashboard → Logs → Realtime
   - Look for connection/subscription errors

3. **Test with Simple Subscription**
   ```javascript
   // Test without filters
   supabase
     .channel('test-all')
     .on('postgres_changes', 
       { event: '*', schema: 'public', table: 'messages' },
       (payload) => console.log('Any message change:', payload)
     )
     .subscribe();
   ```

4. **Verify Auth Token**
   - Realtime uses auth token for RLS
   - Check if token is expired or invalid

## Current Workaround
The app uses adaptive polling as a fallback:
- Polls every 3 seconds when new messages detected
- Slows to 30 seconds when idle
- Efficient single-query approach

## Recommendation
Since polling is working efficiently, consider:
1. Keep polling as primary method for now
2. Re-enable WebSocket when using development build
3. Monitor Supabase for WebSocket improvements