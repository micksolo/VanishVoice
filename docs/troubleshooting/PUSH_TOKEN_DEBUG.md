# Push Token Registration Debug Guide

## Expected Console Output

When the app starts, you should see:
```
App ownership: expo
Expo config: { name: 'VanishVoice', slug: 'VanishVoice', owner: 'micksolo', ... }
Using experienceId for Expo Go: @micksolo/VanishVoice
Push token: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
Push token saved successfully
```

## If Token Generation Fails

1. **Check Permissions**
   - iOS: Settings > VanishVoice > Notifications (should be enabled)
   - Android: Settings > Apps > VanishVoice > Notifications (should be allowed)

2. **Verify Physical Device**
   - Push notifications don't work on simulators/emulators
   - Must test on real iOS/Android devices

3. **Check Expo Go Version**
   - Update Expo Go to latest version from App Store/Play Store
   - The app should show "Expo Go" at the top when running

4. **Verify Database**
   After successful registration, check Supabase:
   - Go to Table Editor > push_tokens
   - You should see entries with:
     - user_id: Your user's ID
     - token: ExponentPushToken[...]
     - platform: ios or android

## Common Issues

### "No projectId found"
- Fixed by using experienceId for Expo Go
- The app now detects Expo Go environment automatically

### "Permission denied"
- User must grant notification permissions
- On iOS, this prompt appears only once
- If denied, must be enabled in device settings

### Token not saving to database
- Check console for "Push token saved successfully"
- Verify user is authenticated (has valid user.id)
- Check Supabase connection is working

## Testing Push Notifications

1. **Ensure both devices have tokens**
   - Check push_tokens table has entries for both users

2. **Send a test message**
   - Device A sends voice message to Device B
   - Console should show "Sending push notification to: [user-id]"
   - Device B should receive notification

3. **Check Edge Function Logs**
   - Supabase Dashboard > Functions > send-push-notification > Logs
   - Look for successful invocations or errors