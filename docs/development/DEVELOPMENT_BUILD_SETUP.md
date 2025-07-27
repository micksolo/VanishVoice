# Development Build Setup Guide

This guide documents the setup for Expo Development Builds, which allows us to use native modules like react-native-compressor while maintaining most of the Expo managed workflow benefits.

## Prerequisites

- EAS CLI installed globally: `npm install -g eas-cli`
- Expo account (free tier is sufficient)
- For iOS development: macOS with Xcode installed
- For Android development: Android Studio or Android SDK

## Configuration Files

### 1. **eas.json**
Defines build profiles for different environments:
- `development`: For iOS simulator and Android emulator
- `development-device`: For physical devices
- `preview`: For internal testing
- `production`: For app store releases

### 2. **app.config.js**
Dynamic configuration that extends app.json:
- Configures plugins for native modules
- Sets platform-specific build settings
- Manages development client configuration

### 3. **metro.config.js**
Metro bundler configuration:
- Supports CommonJS modules (.cjs)
- Handles native module resolution
- Clears cache to avoid native module issues

### 4. **expo-dev-client.config.js**
Custom development client settings:
- Enables hot reload for native modules
- Configures autolinking
- Supports new architecture (Fabric/TurboModules)

## Building Development Clients

### First Time Setup

1. **Login to EAS**
   ```bash
   eas login
   ```

2. **Configure the project** (if not already done)
   ```bash
   eas build:configure
   ```

### Building for Simulators/Emulators

**iOS Simulator:**
```bash
npm run build:dev:ios
```

**Android Emulator:**
```bash
npm run build:dev:android
```

**Both platforms:**
```bash
npm run build:dev:all
```

### Building for Physical Devices

**iOS Device:**
```bash
npm run build:device:ios
```

**Android Device:**
```bash
npm run build:device:android
```

## Running the Development Client

1. **Install the built app** on your simulator/device
   - For iOS: The build will be automatically installed if using simulator
   - For Android: Download the APK and install it
   - For devices: Use the QR code or link provided by EAS

2. **Start the development server:**
   ```bash
   npm run start:dev
   ```

3. **Connect to the dev server:**
   - Open the installed development client app
   - It should automatically connect to your local server
   - If not, scan the QR code from the terminal

## Adding Native Modules

When adding native modules like react-native-compressor:

1. **Install the package:**
   ```bash
   npm install react-native-compressor
   ```

2. **Configure the plugin** (if needed) in app.config.js:
   ```javascript
   plugins: [
     ['react-native-compressor', {
       // plugin config
     }]
   ]
   ```

3. **Rebuild the development client:**
   ```bash
   npm run prebuild:clean
   npm run build:dev:all
   ```

## Troubleshooting

### Metro Cache Issues
If you encounter module resolution errors:
```bash
npx expo start --clear
```

### Build Failures
1. Check EAS build logs in the terminal or at https://expo.dev
2. Ensure all native dependencies are properly configured
3. Try cleaning and rebuilding:
   ```bash
   npm run prebuild:clean
   npm run build:dev:all
   ```

### Development Client Won't Connect
1. Ensure your device/simulator is on the same network
2. Check firewall settings
3. Try using the tunnel option:
   ```bash
   npx expo start --tunnel
   ```

## Important Notes

- Development builds are larger than Expo Go apps
- You need to rebuild when adding/removing native modules
- Keep development and production configurations separate
- Test on both iOS and Android before considering features complete

## Next Steps

After setting up development builds, you can:
1. Add react-native-compressor for video compression
2. Implement background upload capabilities
3. Add other performance-enhancing native modules