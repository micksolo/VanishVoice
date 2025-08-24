# Screenshot Prevention - Manual Testing Guide 📱

## Prerequisites

### What You Need:
1. **Two devices** (for testing sender/receiver notifications)
2. **Development builds installed** (or Expo Go for basic testing)
3. **Two test accounts** in VanishVoice
4. **Database access** to verify logs (optional)

---

## 🧪 Test Scenarios

### Test 1: iOS Screenshot Detection (Basic Flow)

**Setup:**
- Device A: iOS (Sender)
- Device B: iOS (Receiver)

**Steps:**
1. **Device A**: Sign in and send a message to Device B
2. **Device B**: Open the chat and view the message
3. **Device B**: Take a screenshot (Volume Up + Power button)
4. **Expected Results:**
   - ✅ **Device A** should receive notification: "Someone screenshotted your message"
   - ✅ **Device B** should see NO notification (correct - they took the screenshot)
   - ✅ Database should log the screenshot attempt

**Console Logs to Check:**
```
[Security] Screenshot detected: {
  messageOwner: [User A ID],
  screenshotter: [User B ID],
  isMyMessage: false,
  shouldNotifyOwner: true
}
```

---

### Test 2: Self-Screenshot (Should NOT Notify)

**Setup:**
- Single device test

**Steps:**
1. Send a message to someone
2. Take a screenshot of YOUR OWN sent message
3. **Expected Results:**
   - ✅ NO notification should appear
   - ✅ Screenshot still logged to database
   - ✅ You don't get notified for screenshotting your own content

---

### Test 3: Android Screenshot Prevention (Premium)

**Setup:**
- Device: Android with development build
- Account: Premium user (or mock premium in code)

**Steps:**
1. Enable secure mode in Security Settings
2. Open a chat with sensitive messages
3. Try to take a screenshot
4. **Expected Results:**
   - ✅ Screenshot should be BLOCKED (black screen or Android security message)
   - ✅ "Screenshot blocked by security policy" system message
   - ✅ No screenshot saved to gallery

**Note:** This ONLY works with development build, not Expo Go!

---

### Test 4: Real-Time Notification Delivery

**Setup:**
- Device A: Sender (any platform)
- Device B: Receiver (iOS preferred for testing)

**Steps:**
1. **Device A**: Send multiple messages in a chat
2. **Device B**: Take screenshots of different messages
3. **Monitor Device A** for notifications
4. **Expected Results:**
   - ✅ Notifications arrive within 1-2 seconds
   - ✅ Each screenshot triggers separate notification
   - ✅ Notifications show even if app is in background

---

### Test 5: Premium Upsell Flow

**Setup:**
- Free user account
- iOS device (for screenshot detection)

**Steps:**
1. Have someone screenshot your message
2. Receive the screenshot notification
3. Tap on the notification or security indicator
4. **Expected Results:**
   - ✅ Premium upsell modal appears
   - ✅ Shows platform-specific features (iOS: detection, Android: blocking)
   - ✅ "Upgrade for $4.99/mo" button visible
   - ✅ Analytics events fire (check console logs)

**Console Logs:**
```
[Monetization] Tracking event: upsell_shown
[Monetization] Tracking event: upgrade_clicked (if clicked)
```

---

## 🔍 How to Verify It's Working

### 1. **Check Console Logs**

Enable debug logging temporarily:
```javascript
// In FriendChatScreen.tsx
const DEBUG_READ_RECEIPTS = false;
const DEBUG_CHAT = true; // Set to true for testing
```

Look for these logs:
```
[Screenshot] iOS screenshot detection enabled
[Security] Screenshot detected: {...}
[Realtime] Subscribed to screenshot notifications
[Push] Sending screenshot notification to: [user_id]
```

### 2. **Check Database** (Supabase)

Query screenshot_attempts table:
```sql
SELECT * FROM screenshot_attempts 
ORDER BY created_at DESC 
LIMIT 10;
```

Should show:
- `user_id`: Who took the screenshot
- `message_id`: Which message was screenshotted
- `platform`: ios/android
- `context`: Additional metadata

### 3. **Check Notification Behavior**

**Correct Behavior:**
- Message SENDER gets notified ✅
- Screenshot TAKER sees nothing ✅
- Notification says "Someone screenshotted your message" ✅

**Wrong Behavior (OLD BUG - NOW FIXED):**
- Screenshot taker gets notified ❌
- Message sender sees nothing ❌

---

## 📱 Platform-Specific Testing

### iOS Testing (Expo Go or Dev Build)
```
✅ Screenshot detection works
✅ Real-time notifications work
✅ Push notifications work (if configured)
❌ Cannot prevent screenshots (iOS limitation)
```

### Android Testing

**Expo Go:**
```
⚠️ Screenshot detection limited
⚠️ No prevention (mock module used)
✅ Notifications work
```

**Development Build:**
```
✅ FLAG_SECURE screenshot prevention
✅ Complete blocking for premium users
✅ Detection for free users
✅ All notifications work
```

---

## 🐛 Troubleshooting

### "No notifications appearing"

1. **Check SecurityContext is wrapped in App.tsx:**
```javascript
<SecurityProvider>
  <AppContent />
</SecurityProvider>
```

2. **Check real-time subscription is active:**
Look for: `[Realtime] Subscribed to screenshot notifications`

3. **Verify you're testing with different users:**
You won't get notified for your own screenshots!

### "Android screenshots not blocked"

1. **Verify development build installed:**
```
[ScreenshotPrevent] Native module not available - using mock
```
This means you need the dev build!

2. **Check premium status:**
Only premium users get screenshot blocking on Android

### "Wrong person getting notified"

This was the OLD bug - if you're still seeing this:
1. Pull latest code
2. Check SecurityContext.tsx has the updated logic
3. Clear app data and restart

---

## ✅ Testing Checklist

- [ ] iOS screenshot detection works
- [ ] Correct person gets notified (message owner, not screenshotter)
- [ ] No self-notification for own screenshots
- [ ] Real-time notifications arrive quickly
- [ ] Premium upsell appears for free users
- [ ] Database logs screenshot attempts
- [ ] Android dev build blocks screenshots (premium)
- [ ] Push notifications work when app backgrounded
- [ ] Security indicators show in UI
- [ ] Analytics events fire correctly

---

## 🎯 Quick Test (2 minutes)

**Fastest way to verify it's working:**

1. Open VanishVoice on two devices
2. Device A sends message to Device B
3. Device B takes screenshot
4. Device A should get notified immediately
5. Device B should see nothing

**If this works, the core feature is functioning correctly!**

---

## 📊 Success Metrics

After testing, you should see:
- **Notifications**: Going to correct person (message owners)
- **Timing**: Real-time delivery (1-2 seconds)
- **Database**: Screenshot attempts logged with context
- **Analytics**: Conversion events tracked
- **UX**: Beautiful cyberpunk notifications and upsells
- **Android**: Screenshots blocked with dev build (premium)

The screenshot prevention system should feel premium, protective, and drive conversions!