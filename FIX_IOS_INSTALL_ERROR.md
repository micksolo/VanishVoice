# Fix iOS "Unable to Install VanishVoice" Error

## Problem Diagnosis

The "Unable to install VanishVoice" error when opening the app indicates one of these issues:

1. **Wrong Build Type**: Your current build (80b85f0a) was created with the `development` profile which has `"simulator": true` - this CANNOT run on physical devices
2. **Expired Provisioning**: The provisioning profile may have expired
3. **Device Not Registered**: Your device UDID might not be in the provisioning profile

## Immediate Solution

### Option 1: Delete and Rebuild (Recommended)

1. **Delete the current app from your iPhone**:
   - Long press the VanishVoice icon
   - Tap the X to delete
   - Confirm deletion

2. **Create a new build for physical devices**:
   ```bash
   # This will prompt for Apple credentials
   eas build --platform ios --profile development-device
   ```

3. **During the build process**:
   - When asked about Apple account, select YES
   - Provide your Apple ID credentials
   - EAS will handle provisioning profile creation
   - Make sure your device is registered

4. **Install the new build**:
   - Once complete, use the **Install URL** (not QR code)
   - Open in Safari on your iPhone
   - Trust the developer profile in Settings

### Option 2: Use Simulator Instead (Quick Testing)

If you just need to test quickly:

```bash
# Open iOS Simulator
open -a Simulator

# Select iPhone SE 3rd generation
# Device > iPhone SE (3rd generation)

# Start Metro bundler
npx expo start --clear

# Press 'i' to open in iOS simulator
```

### Option 3: TestFlight Distribution (Most Reliable)

For more reliable testing on physical devices:

```bash
# Create a preview build
eas build --platform ios --profile preview

# Once complete, submit to TestFlight
eas submit --platform ios --latest

# Install via TestFlight app on your iPhone
```

## Why This Happened

Your last build configuration was:
- Profile: `development` (simulator-only)
- Distribution: `internal`
- Simulator: `true` ❌ (This is the problem)

Physical devices need:
- Profile: `development-device`
- Distribution: `internal`
- Simulator: `false` ✅

## Verification After Fix

Once you have the correct build installed:

1. App should open without errors
2. You should see the Expo development menu
3. Connect to Metro bundler at your local IP
4. Test screenshot prevention features

## Command to Start New Build

Run this command and follow the interactive prompts:

```bash
eas build --platform ios --profile development-device
```

When prompted:
1. Log in to Apple account: **YES**
2. Let EAS manage credentials: **YES**
3. Register device if needed: **YES**

The build will take about 10-15 minutes. Use the install URL (not QR) when complete.