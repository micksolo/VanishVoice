# Setting Up Development Build for Push Notifications

Since Expo Go no longer supports push notifications in SDK 53, you need to create a development build.

## Quick Start

### 1. Install EAS CLI globally (if not already installed)
```bash
npm install -g eas-cli
```

### 2. Initialize EAS in your project
```bash
cd /Users/mick/Documents/GitHub/VanishVoice
eas init
```

When prompted:
- Select "Create a new EAS project"
- It will create a project ID for you

### 3. Configure for development build
The `eas.json` file is already created with proper configuration.

### 4. Create development build

For iOS (requires Apple Developer account):
```bash
eas build --profile development --platform ios
```

For Android (easier to start with):
```bash
eas build --profile development --platform android
```

### 5. Install the development build
- Once built, download the APK (Android) or use TestFlight (iOS)
- Install on your physical devices
- The development build will work just like Expo Go but with push notification support

## Alternative: Local Development Build

If you want to build locally without EAS:

### For Android:
```bash
npx expo prebuild
npx expo run:android
```

### For iOS (requires Mac with Xcode):
```bash
npx expo prebuild
npx expo run:ios --device
```

## Temporary Workaround

While setting up the development build, you can:
1. Test other features in Expo Go
2. Use the "Test Push Notification" button in Profile > Debug to verify local notifications work
3. The push notification infrastructure is ready and will work once you have a development build

## Update the Push Notification Service

Once you have a project ID from EAS, update the push notification service: