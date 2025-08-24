# Development Build Instructions for VanishVoice 🚀

## Prerequisites

### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

### 2. Login to Expo Account
```bash
eas login
```
Use your Expo account credentials (username: micksolo)

### 3. Verify Project Setup
```bash
eas whoami
# Should show: micksolo

eas project:info
# Should show: VanishVoice project details
```

---

## 🏗️ Creating Development Builds

### Option 1: Build for Both Platforms (Recommended)

```bash
# Clean prebuild first (removes old native folders)
npx expo prebuild --clean

# Build for both iOS and Android
eas build --profile development --platform all
```

### Option 2: Platform-Specific Builds

#### iOS Development Build
```bash
# For iOS Simulator
eas build --profile development --platform ios

# For Physical iOS Device
eas build --profile development-device --platform ios
```

#### Android Development Build
```bash
# For Android Emulator/Device (APK)
eas build --profile development --platform android

# For Physical Android Device (AAB)
eas build --profile development-device --platform android
```

---

## 📱 Installing Development Builds

### After Build Completes (15-30 minutes)

1. **Check build status:**
```bash
eas build:list
# Or visit: https://expo.dev/accounts/micksolo/projects/VanishVoice/builds
```

2. **Download and Install:**

#### iOS (Simulator)
```bash
# Download the build
eas build:run -p ios

# Or manually:
# 1. Download .tar.gz file from Expo dashboard
# 2. Extract and drag .app file to iOS Simulator
```

#### iOS (Physical Device)
- Scan QR code from Expo dashboard with Camera app
- Install via TestFlight (if configured)
- Or use Apple Configurator 2

#### Android
```bash
# Install on connected device/emulator
eas build:run -p android

# Or manually:
# 1. Download .apk from Expo dashboard
# 2. Install: adb install path/to/app.apk
```

---

## 🔧 Configuration Check

### Verify Native Module Configuration

**Check app.config.js has the plugin:**
```javascript
plugins: [
  // ... other plugins
  ['./plugins/withScreenshotPrevention', { enabled: true }],
]
```

**Check eas.json profiles:**
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": true
      }
    },
    "development-device": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": false
      }
    }
  }
}
```

---

## 🎯 Quick Build Commands

### For Testing Screenshot Prevention

**Best for Testing (Simulator/Emulator):**
```bash
# Clean and build for both platforms
npx expo prebuild --clean
eas build --profile development --platform all
```

**For Physical Devices:**
```bash
# Android physical device
eas build --profile development-device --platform android

# iOS physical device (requires Apple Developer account)
eas build --profile development-device --platform ios
```

---

## 🧪 Testing the Native Module

### After Installing Development Build

1. **Start the dev server:**
```bash
npx expo start --dev-client
# Or
npx expo start --clear
```

2. **Open the app:**
- Scan QR code with Expo Go (development build version)
- Or press 'a' for Android, 'i' for iOS

3. **Verify native module is working:**

Look for these logs:
```
✅ Android: No warning about "Native module not available"
✅ iOS: Screenshot detection working
```

If you see this warning, the native module isn't loaded:
```
⚠️ [ScreenshotPrevent] Native module not available - using mock
```

---

## 🐛 Troubleshooting

### "Build failed"

1. **Check error logs:**
```bash
eas build:view [build-id]
```

2. **Common fixes:**
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install

# Clean prebuild
npx expo prebuild --clean

# Retry build
eas build --profile development --platform [ios/android]
```

### "Native module not found"

1. **Ensure you're using development build, not Expo Go**
2. **Check the plugin is enabled:**
```javascript
// app.config.js
['./plugins/withScreenshotPrevention', { enabled: true }]
```

3. **Rebuild if needed:**
```bash
npx expo prebuild --clean
eas build --profile development --platform all
```

### "Screenshot still not blocked on Android"

1. **Verify it's a development build** (not Expo Go)
2. **Check premium status** in the app
3. **Enable secure mode** in Security Settings
4. **Look for logs:**
```
[Screenshot] Android FLAG_SECURE enabled
```

---

## ✅ Success Checklist

After successful build and installation:

- [ ] Development build installed (not Expo Go)
- [ ] No "Native module not available" warnings
- [ ] Android: Screenshots blocked for premium users
- [ ] iOS: Screenshot detection with notifications
- [ ] Security indicators appear in UI
- [ ] Premium upsell modals work
- [ ] Real-time notifications deliver correctly

---

## 📊 Build Status & Links

### Check Your Builds
- **Dashboard**: https://expo.dev/accounts/micksolo/projects/VanishVoice/builds
- **CLI**: `eas build:list`

### Recent Successful Builds (from our session):
- **Android**: Build ID `0a6b1823-5513-4c64-88a8-3bf5305f87db`
- **iOS**: Build ID `a6a5804d-c16e-48c7-b016-b5b9df9727fb`

---

## 🚀 Production Build (When Ready)

```bash
# Production builds for app stores
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## 📝 Summary

**For immediate testing of screenshot prevention:**
```bash
# Quick development build
npx expo prebuild --clean
eas build --profile development --platform all

# Wait 15-30 minutes for build
# Install and test!
```

The development build will have:
- ✅ Android FLAG_SECURE screenshot blocking
- ✅ iOS screenshot detection
- ✅ All native modules working
- ✅ Real device testing capability