# Push Notification Testing Checklist

## Prerequisites
1. **Deploy Edge Function to Supabase**
   ```bash
   npx supabase functions deploy send-push-notification
   ```

2. **Verify Push Tokens**
   - Check that both devices have push tokens saved in the database
   - SQL: `SELECT id, username, push_token FROM users WHERE push_token IS NOT NULL;`

## Test Scenarios

### Test 1: Basic Push Delivery
**Steps:**
1. Device1: Send a text message to Device2
2. Device2: Should receive push notification immediately
3. Check console logs for:
   - `[Push] Notification sent successfully to: [recipient_id]`
   - `[FriendsListScreen] Push notification received:`

**Expected:**
- Push notification appears with sender's username
- Unread count updates without polling

### Test 2: App States
Test push delivery in different app states:

#### A. App in Foreground
- Device2 has Friends screen open
- Send message from Device1
- **Expected:** Unread badge updates instantly, notification banner shows

#### B. App in Background
- Device2: Press home button (app in background)
- Send message from Device1
- **Expected:** System notification appears

#### C. App Killed
- Device2: Force quit the app
- Send message from Device1
- **Expected:** System notification appears

### Test 3: Notification Tap
1. Device2: Receive notification while app is backgrounded
2. Tap the notification
3. **Expected:** App opens directly to chat with Device1

### Test 4: Multiple Messages
1. Send 3 messages rapidly from Device1 to Device2
2. **Expected:** 
   - All 3 notifications delivered
   - Unread count shows "3"
   - No polling queries in logs

### Test 5: Performance Comparison
1. Monitor console logs before/after push implementation
2. **Before (Polling):**
   - Logs show: `[FriendsListScreen] Starting polling update...` every 3-30 seconds
   - Multiple database queries

3. **After (Push):**
   - No polling logs
   - Only see: `[FriendsListScreen] Push notification received:`
   - Database queries only on screen focus

## Debugging

### If Push Not Working:
1. **Check Edge Function Logs**
   - Supabase Dashboard → Functions → Logs
   - Look for errors in send-push-notification

2. **Verify Push Token**
   ```javascript
   // In console
   const { data } = await supabase
     .from('users')
     .select('push_token')
     .eq('id', 'USER_ID');
   console.log(data);
   ```

3. **Test Edge Function Directly**
   ```javascript
   const { data, error } = await supabase.functions.invoke('send-push-notification', {
     body: {
       recipient_id: 'RECIPIENT_USER_ID',
       title: 'Test',
       body: 'Test message',
       data: { type: 'new_message' }
     }
   });
   console.log({ data, error });
   ```

4. **Common Issues:**
   - Push notifications disabled in device settings
   - Expo Go limitations (try development build)
   - Edge Function not deployed
   - Missing SUPABASE_SERVICE_ROLE_KEY in Edge Functions

## Performance Metrics

### Measure Before/After:
1. **Database Reads per Minute**
   - Before: ~20-200 reads/minute per user
   - After: ~0 reads/minute (only on app focus)

2. **Message Delivery Latency**
   - Before: 3-30 seconds (polling interval)
   - After: <1 second (push delivery)

3. **Battery Usage**
   - Monitor Settings → Battery → Your App
   - Should see significant reduction

## Success Criteria
- [ ] Push notifications work in all app states
- [ ] Zero polling when app is backgrounded
- [ ] Unread counts update instantly via push
- [ ] 90%+ reduction in database queries
- [ ] <2 second message delivery time