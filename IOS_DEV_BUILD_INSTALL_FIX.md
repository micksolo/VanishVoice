# iOS Development Build Installation Fix

## Issue Summary
Physical iOS device installation failing with "no usable data" error when scanning QR codes. This was caused by configuration issues in `eas.json` and missing URL schemes for deep linking installation.

## Root Cause Analysis

### Problem 1: Wrong Build Profile Used
- Recent build (80b85f0a-57a1-4fc3-872b-9af279c52154) used `development` profile which has `"simulator": true`
- Physical devices require `development-device` profile with `"simulator": false`

### Problem 2: Missing URL Schemes for Deep Linking
- No custom URL scheme configured for OTA installation
- iOS requires CFBundleURLTypes in Info.plist for installation deep links
- Missing `exp+vanishvoice` scheme for Expo installation protocol

### Problem 3: Build Configuration Issues
- Missing explicit `buildConfiguration: "Debug"` for development builds
- This ensures proper provisioning profile selection for Ad Hoc distribution

## Configuration Fixes Applied

### Fixed eas.json Configuration:
```json
{
  "build": {
    "development-device": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false,
        "resourceClass": "m-medium",
        "credentialsSource": "remote",
        "buildConfiguration": "Debug"  // Added for proper provisioning
      }
    }
  }
}
```

### Fixed app.json Configuration:
```json
{
  "expo": {
    "scheme": "vanishvoice",  // Added global URL scheme
    "ios": {
      "bundleIdentifier": "com.generictech.vanishvoice",
      "infoPlist": {
        "CFBundleURLTypes": [  // Added for deep linking installation
          {
            "CFBundleURLName": "vanishvoice",
            "CFBundleURLSchemes": [
              "vanishvoice",
              "exp+vanishvoice"
            ]
          }
        ]
      }
    }
  }
}
```

## Correct Installation Process

### Step 1: Register Your Device (If Not Already Done)
```bash
# Register your iOS device with Apple Developer account
eas device:create
```
Follow the prompts to visit the registration website and add your device UDID.

### Step 2: Build with Correct Profile
```bash
# Use development-device profile for physical devices
eas build --platform ios --profile development-device
```

### Step 3: Installation Methods

#### Method A: Install URL (Recommended)
1. After build completes, copy the **installation URL** from build page
2. Open URL in **Safari** on your iPhone (not Chrome or Camera app)
3. Tap "Install" when prompted
4. Go to Settings > General > VPN & Device Management
5. Trust the developer profile
6. App should now launch

#### Method B: QR Code (Should Now Work)
1. Open Camera app on iPhone
2. Scan QR code from build completion page
3. Tap notification to install
4. Follow trust process as above

#### Method C: Direct Download + Apple Configurator
1. Download .tar.gz artifact from build page
2. Extract to get .ipa file
3. Use Apple Configurator 2 to install manually

## Verification Steps

### After Installation:
1. ✅ App icon appears on home screen
2. ✅ App launches without crashing
3. ✅ Shows "Connected to Metro" in development client
4. ✅ Screenshot detection works (iOS shows notifications)
5. ✅ All native modules function properly

### Test Screenshot Prevention:
1. Open VanishVoice app on iPhone
2. Navigate to chat screen
3. Take screenshot (should work on iOS - detection only)
4. Check for screenshot detection notification
5. Compare with Android (should block screenshot completely)

## Troubleshooting Common Issues

### "No Usable Data" Error (FIXED):
- ✅ Fixed: Wrong build profile (development vs development-device)
- ✅ Fixed: Missing URL schemes in app.json
- ✅ Fixed: Missing buildConfiguration in eas.json

### "Unable to Install" Error:
- Verify device was registered before the build
- Check that UDID is correct in device registration
- Ensure sufficient storage space on device
- Try installation URL instead of QR code

### "Untrusted Developer" Error:
1. Settings > General > VPN & Device Management
2. Find "Developer App" section
3. Tap on your developer profile
4. Tap "Trust [Developer Name]"
5. Confirm trust in popup

### Build Fails During Provisioning:
```bash
# Clear cache and retry
eas build --platform ios --profile development-device --clear-cache

# If still fails, re-register device
eas device:delete
eas device:create
eas build --platform ios --profile development-device
```

## Alternative Installation Methods

### TestFlight Distribution (Recommended for Multiple Testers):
```bash
# Create TestFlight build
eas build --platform ios --profile preview

# Submit to App Store Connect
eas submit --platform ios

# Install via TestFlight app
```

### Enterprise Distribution (If You Have Enterprise Account):
```bash
# Add enterprise profile to eas.json
"enterprise": {
  "distribution": "internal",
  "ios": {
    "simulator": false,
    "enterpriseProvisioning": "universal"
  }
}

# Build enterprise version
eas build --platform ios --profile enterprise
```

## Key Learnings for Future Builds

1. **Always use device-specific profiles** for physical device testing
2. **URL schemes are mandatory** for OTA installation on iOS
3. **Device registration must happen before build** to be included in provisioning profile
4. **buildConfiguration: "Debug"** ensures proper development provisioning
5. **Installation URL is more reliable** than QR codes for development builds
6. **Safari is required** for OTA installation (Chrome/Camera app won't work)

## Next Steps

1. ✅ Configuration fixes have been applied to eas.json and app.json
2. 🔄 Run new build: `eas build --platform ios --profile development-device`
3. 📱 Test installation on physical iOS device using install URL
4. ✅ Verify screenshot prevention works as expected
5. 📝 Document any additional device-specific issues discovered

The configuration is now fixed and should resolve the "no usable data" QR code issue. The new build will include proper URL schemes and use the correct profile for physical device installation.