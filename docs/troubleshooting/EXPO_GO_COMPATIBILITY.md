# Expo Go Compatibility Guide

This guide explains how to resolve common issues when running the VanishVoice app in Expo Go vs Development Builds.

## Quick Fix Summary

✅ **FIXED**: App now runs in Expo Go with compatibility layer  
✅ **FIXED**: Video compression gracefully falls back to no compression  
✅ **FIXED**: Push notifications show helpful warnings instead of crashing  

## Current Status

### ✅ What Works in Expo Go
- **Text messaging**: Full E2E encryption working
- **Voice messages**: Recording and playback with E2E encryption
- **Video messages**: Recording working (no compression in Expo Go)
- **Friend system**: Add friends, friend requests, chat
- **Anonymous chat**: Connect with strangers
- **Ephemeral messages**: Time-based expiry working
- **UI features**: Theme switching, navigation, animations

### ⚠️  What Has Limitations in Expo Go
- **Video compression**: Disabled (videos remain original size ~50MB)
- **Push notifications**: Not available (removed from Expo Go in SDK 53)
- **Badge counts**: Not available in Expo Go

### ❌ What Requires Development Build
- Full video compression functionality
- Push notification testing
- Background processing features

## Error Messages You Might See

### 1. "react-native-compressor doesn't seem to be linked"
**Status**: ✅ FIXED  
**Solution**: App now automatically detects Expo Go and uses fallback implementation

### 2. expo-notifications warnings
**Status**: ✅ HANDLED  
**Solution**: App shows warning but continues working. Use development build for push notifications.

### 3. use-latest-callback export warnings
**Status**: ✅ SAFE TO IGNORE  
**Cause**: Third-party React Navigation dependency issue  
**Impact**: None - app functions normally  

## Testing Recommendations

### For Quick Development (Expo Go)
```bash
npx expo start
```
**Best for**: UI changes, text messaging, voice messages, basic features

### For Complete Testing (Development Build)
```bash
# Build once
npm run build:dev:ios    # or android
# Then run
npm run start:dev
```
**Best for**: Video compression, push notifications, production-like testing

## Compatibility Layer Details

The app includes an automatic compatibility system (`src/services/expoGoCompat.ts`) that:

1. **Detects runtime environment** using `Constants.appOwnership === 'expo'`
2. **Provides mock implementations** for native modules in Expo Go
3. **Shows helpful warnings** when features aren't available
4. **Maintains full functionality** in development builds

## When to Use What

| Scenario | Recommended Environment |
|----------|------------------------|
| UI development | Expo Go |
| Text/voice messaging | Expo Go |
| Video features | Development Build |
| Push notifications | Development Build |
| Final testing | Development Build |
| Production testing | Production Build |

## Migration Path

If you want to migrate away from Expo Go completely:

1. **Build development client** (one-time setup):
   ```bash
   npm run build:dev:ios  # or android
   ```

2. **Use development client** for all testing:
   ```bash
   npm run start:dev
   ```

3. **Benefits**: Full native module support, production-like environment

## Still Having Issues?

1. **Clear Metro cache**: `npx expo start --clear`
2. **Check the console** for specific error messages
3. **Try development build** if Expo Go isn't working
4. **Review logs** in the terminal for compatibility warnings

The app is designed to work in both environments with graceful degradation of features that require native modules.