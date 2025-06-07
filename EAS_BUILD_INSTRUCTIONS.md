# EAS Build Instructions for Wireless Distribution

## Prerequisites
1. Make sure you're logged in to Expo:
   ```bash
   npx expo whoami
   # Should show: micksolo
   ```

2. Update EAS CLI to latest version (recommended):
   ```bash
   npm install -g eas-cli
   ```

## Building for Android (Easiest - No Developer Account Needed)

Run this command and answer the prompts:

```bash
cd /Users/mick/Documents/GitHub/VanishVoice
eas build --profile development --platform android
```

When prompted:
1. **"Generate a new Android Keystore?"** → Answer: **Yes**
2. Wait for the build to queue (you'll see a URL)
3. The build takes 10-20 minutes

Once complete:
- You'll get a download link for the APK
- Download it on your Android device
- Install the APK (you may need to enable "Install from unknown sources")
- Open the app and it will connect to your development server

## Building for iOS (Requires Apple Developer Account)

If you have an Apple Developer account ($99/year):

```bash
eas build --profile development --platform ios
```

When prompted:
1. **"Do you have access to the Apple Developer Program?"** → Answer based on your status
2. If yes, log in with your Apple ID
3. Let EAS handle the provisioning profiles

If you DON'T have an Apple Developer account:
- Use the **iOS Simulator** for now
- Or get an Apple Developer account
- Or use **Android** for testing push notifications

## Alternative: Ad Hoc Distribution Without Developer Account

For iOS without a developer account, you can:
1. Use the simulator build you already have
2. Test on Android devices (much easier)
3. Use TestFlight once you have a developer account

## Monitoring Your Build

1. After starting the build, you'll get a URL like:
   ```
   https://expo.dev/accounts/micksolo/projects/VanishVoice/builds/[build-id]
   ```

2. Open this URL to:
   - Watch build progress
   - Download the app when ready
   - Get a QR code for installation

## Quick Android Build Command

For the fastest results, just run:
```bash
# This will build an APK you can share with anyone
eas build --profile development --platform android --non-interactive --no-wait
```

Then check the URL it gives you for the download link!

## After Installation

1. Install the APK/IPA on your device
2. Open the app (shows "Development Build")
3. Start your dev server: `npx expo start --dev-client`
4. Connect to your development machine's IP

## Troubleshooting

- **"Keystore not found"**: Choose to generate a new one
- **"No bundle ID"**: Already set to `com.vanishvoice.app`
- **Build fails**: Check the build logs at the provided URL
- **Can't install on iOS**: Need developer account or use simulator