# Push Notifications Testing Guide

## Overview
Push notifications have been implemented for VanishVoice using Expo Push Notification Service. The implementation includes:

1. **Client-side setup**: Using `expo-notifications` and `expo-device`
2. **Database**: `push_tokens` table to store user tokens
3. **Edge Function**: `send-push-notification` to handle sending notifications
4. **Integration**: Notifications are sent when new voice messages are received

## Testing Steps

### 1. Test on Physical Device
Push notifications only work on physical devices, not simulators.

1. Connect your iOS or Android device
2. Run the app using:
   ```bash
   npx expo run:ios --device
   # or
   npx expo run:android --device
   ```

### 2. Grant Notification Permissions
1. When the app launches, you'll be prompted to allow notifications
2. Grant permission to receive push notifications

### 3. Test Local Notifications
1. Go to the Profile tab
2. Scroll down to the Debug section
3. Tap "Test Push Notification"
4. You should see a notification appear (may appear in notification center if app is in foreground)

### 4. Test Remote Push Notifications
1. Add a friend using their friend code
2. Have the friend send you a voice message
3. You should receive a push notification with:
   - Title: "New Voice Message"
   - Body: "[Friend's name] sent you a voice message"

### 5. Verify Token Storage
Check if push tokens are being saved:
1. Check the Supabase dashboard
2. Look at the `push_tokens` table
3. You should see entries with your user_id, token, and platform

## Troubleshooting

### No Notifications Received
1. **Check permissions**: Go to device settings and ensure notifications are enabled for VanishVoice
2. **Check token**: Add console logging to see if push token is generated:
   ```javascript
   console.log('Push token:', token.data);
   ```
3. **Check edge function logs**: View Supabase edge function logs for errors

### Token Generation Fails
1. Ensure you're testing on a physical device
2. For iOS: Ensure you have proper certificates set up
3. For Android: Ensure you have FCM configured (if using FCM)

### Edge Function Errors
1. Check Supabase edge function logs
2. Verify the function is deployed and active
3. Check that authentication headers are being sent

## Next Steps

1. **iOS Setup**: Configure Apple Push Notification service (APNs) certificates
2. **Android Setup**: Configure Firebase Cloud Messaging (FCM) 
3. **Badge Management**: Implement proper badge count management
4. **Rich Notifications**: Add support for notification actions (play, delete)
5. **Notification Categories**: Set up different notification types for different events

## Important Notes

- Push tokens may change, so the app re-registers on each launch
- Tokens are platform-specific (iOS vs Android)
- The Expo Push Service acts as a proxy to APNs and FCM
- For production, you'll need to configure your own push notification credentials