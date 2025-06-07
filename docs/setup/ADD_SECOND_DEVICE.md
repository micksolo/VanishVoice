# Adding a Second iOS Device to Your Development Build

## Method 1: Using EAS CLI (Recommended)

### Step 1: Register the Device
On your second iOS device:
1. Open Safari and go to: https://expo.dev/register
2. Sign in with your Expo account
3. Follow the prompts to install a provisioning profile
4. This will register your device with Expo

### Step 2: Add Device to Your Project
```bash
# Register a new device
eas device:create

# This will give you a QR code/URL
# Open it on your second device to register it
```

### Step 3: Rebuild with Updated Devices
```bash
# Rebuild to include the new device
eas build --platform ios --profile development --clear-cache
```

## Method 2: Manual Apple Developer Portal

### Step 1: Get Device UDID
On your second iOS device:
1. Connect to Mac via USB
2. Open Finder (macOS Catalina+) or iTunes
3. Click on your device
4. Click on device info to reveal UDID
5. Copy the UDID

### Step 2: Add to Apple Developer Portal
1. Go to https://developer.apple.com
2. Sign in and go to "Certificates, IDs & Profiles"
3. Click "Devices" → "+"
4. Add your device name and UDID

### Step 3: Update Provisioning Profile
```bash
# Force EAS to fetch updated provisioning profiles
eas build --platform ios --profile development --clear-cache
```

## Method 3: Using Xcode (If You Have the Project)

### Step 1: Open in Xcode
```bash
# Generate native project if needed
npx expo prebuild -p ios

# Open in Xcode
open ios/*.xcworkspace
```

### Step 2: Add Device in Xcode
1. Connect your second device via USB
2. In Xcode: Window → Devices and Simulators
3. Click "Use for Development" on your device
4. Xcode will register it automatically

## Quick Option: Ad Hoc Distribution

If you need to quickly share with just a few devices:

```bash
# Create an ad-hoc build that works on specific devices
eas build --platform ios --profile preview
```

Then share the IPA file via TestFlight or direct installation.

## Checking Registered Devices

```bash
# List all registered devices
eas device:list

# View current build's device compatibility
eas build:view [BUILD_ID]
```

## Important Notes

1. **Development builds** are tied to specific devices via provisioning profiles
2. **Each new device** requires a rebuild to include it
3. **TestFlight** doesn't require device registration (better for multiple testers)
4. **Ad hoc builds** can include up to 100 devices

## Troubleshooting

### "Device not eligible"
- Ensure device UDID is correctly registered
- Rebuild with `--clear-cache` flag
- Check device iOS version compatibility

### "Provisioning profile doesn't match"
- The build was made before adding the device
- Need to create a new build

### Can't install on device
- Check device is registered in Apple Developer Portal
- Ensure you're using the correct build profile
- Verify device trusts your developer certificate

## Recommended Approach

For ongoing development with multiple devices, consider:
1. Use **TestFlight** for easier distribution
2. Create a **preview** profile in `eas.json` for ad-hoc builds
3. Set up **internal distribution** for your team

Would you like me to help you set up any of these methods?