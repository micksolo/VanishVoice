# Rebuild Development Builds with Native Screenshot Module

## Problem
The native screenshot prevention module exists but isn't included in current development builds, causing:
- Android: FLAG_SECURE not working (screenshots not blocked)
- iOS: Cross-device notifications may fail

## Solution: Rebuild Both Platforms

### Step 1: Clean and Prebuild
```bash
# Clean any existing prebuild artifacts
npx expo prebuild --clean

# This will generate native Android/iOS projects with the module included
```

### Step 2: Build for Android
```bash
# For physical Android device
eas build --platform android --profile development-device

# Or if using emulator
eas build --platform android --profile development
```

### Step 3: Build for iOS  
```bash
# For physical iOS device (your case)
eas build --platform ios --profile development-device
```

### Step 4: Install New Builds
1. **Android**: Download APK and install
2. **iOS**: Use install URL in Safari (not QR code)

## Why This Is Needed

Expo local modules (in `/modules` directory) are compiled into the native app at build time. Your current builds were created before the module was properly configured, so they're using the mock JavaScript implementation instead of the real native code.

## Expected Result After Rebuild

When you reload the app after installing new builds:
- `[NATIVE MODULE CHECK] ScreenshotPrevent exists? true` ✅
- Android: Screenshots will be completely blocked
- iOS: Screenshot detection will notify message owners

## Build Commands Summary

```bash
# Both platforms at once
eas build --platform all --profile development-device

# Or separately
eas build --platform android --profile development-device
eas build --platform ios --profile development-device
```

The builds will take 10-20 minutes each. Once complete, the native module will be properly included.