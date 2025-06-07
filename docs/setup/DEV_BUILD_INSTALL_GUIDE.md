# Development Build Installation Guide

## Understanding the QR Code Error

When you see "no usable data found" it means:
- You're trying to scan a Metro bundler QR code with a camera app
- Development builds can't be installed via QR code like Expo Go apps
- The QR code is only for connecting an already-installed dev build to Metro

## Installing on Physical iOS Devices

### Method 1: Direct USB Install (Recommended)
```bash
# 1. Connect iPhone via USB cable
# 2. Trust the computer on your iPhone
# 3. Run:
npx expo run:ios --device

# 4. Select your device from the list
# 5. Wait for build and installation
```

### Method 2: Wireless via EAS Build
```bash
# 1. Create a build for internal distribution
eas build --profile development --platform ios

# 2. Wait for build (10-20 minutes)
# 3. You'll get a URL like: https://expo.dev/accounts/[username]/projects/VanishVoice/builds/[build-id]
# 4. Open this URL on your iPhone
# 5. Tap "Install" to download the build
```

### Method 3: Using Apple Configurator 2 (Mac only)
1. Download the .app file from your build
2. Use Apple Configurator 2 to install

## Installing on Physical Android Devices

### For Android (Much Easier)
```bash
# 1. Enable Developer Mode and USB Debugging on Android
# 2. Connect via USB
# 3. Run:
npx expo run:android --device

# OR build APK:
eas build --profile development --platform android
# Download and install the APK
```

## After Installation

Once the dev build is installed:
1. Open the app (it will show "Development Build" at the top)
2. It will show a screen to "Enter URL manually" or scan QR
3. NOW you can scan the QR code from `npx expo start --dev-client`
4. Or enter your computer's URL manually: `http://[YOUR-IP]:8081`

## Quick Commands Reference

```bash
# Start Metro for dev builds (after app is installed)
npx expo start --dev-client

# Install on connected iOS device
npx expo run:ios --device

# Install on connected Android device  
npx expo run:android --device

# Create shareable iOS build
eas build --profile development --platform ios

# Create shareable Android build
eas build --profile development --platform android
```

## Troubleshooting

1. **"No provisioning profile" error**: You need an Apple Developer account ($99/year)
2. **"Device not trusted"**: Go to Settings > General > Device Management on iPhone
3. **Can't see device**: Make sure USB debugging is enabled and cable is data-capable

## Alternative: Use Android First

Android is much easier for development:
- No developer account needed
- APK can be shared easily
- Installation is straightforward

Start with Android testing while setting up iOS certificates!