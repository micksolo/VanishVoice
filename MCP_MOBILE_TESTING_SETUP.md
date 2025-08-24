# MCP Mobile Testing Setup for VanishVoice 🧪

## Overview
This guide sets up automated mobile testing using @mobilenext/mobile-mcp server for testing screenshot prevention and cross-platform notifications.

## Prerequisites

### 1. Install MCP Mobile Server
```bash
# Global installation (recommended)
npm install -g @mobilenext/mobile-mcp

# Or use npx (no installation needed)
npx -y @mobilenext/mobile-mcp@latest
```

### 2. Configure Claude MCP Settings

Add to your `~/.claude.json` or project-specific `.claude/settings.json`:

```json
{
  "mcpServers": {
    "mobile-mcp": {
      "command": "npx",
      "args": ["-y", "@mobilenext/mobile-mcp@latest"],
      "env": {
        "EXPO_PUBLIC_TESTING_MODE": "true"
      }
    }
  }
}
```

### 3. Platform Setup

#### iOS (Simulator)
- Install Xcode from Mac App Store
- Open Xcode and install iOS Simulator
- Launch a simulator: `xcrun simctl boot "iPhone 15"`

#### Android (MuMu Emulator or Android Studio)
**For MuMu Emulator:**
- Ensure MuMu is running
- Enable Developer Options and USB Debugging
- Connect via ADB: `adb connect 127.0.0.1:7555`

**For Android Studio Emulator:**
- Install Android Studio
- Create AVD (Android Virtual Device)
- Start emulator from AVD Manager

## Testing Environment Setup

### 1. Enable Testing Mode
Set environment variable to disable animations during tests:
```bash
export EXPO_PUBLIC_TESTING_MODE=true
npx expo start --dev-client
```

### 2. Install Development Builds

#### iOS Development Build
```bash
# Build for iOS simulator
eas build --profile development --platform ios

# Install on simulator
eas build:run -p ios
```

#### Android Development Build
```bash
# Build for Android
eas build --profile development --platform android

# Install on emulator/device
eas build:run -p android
```

## Component Updates for Testing

### Components Updated with Pressable + TestID

1. **RecordButton** (`src/components/RecordButton.tsx`)
   - ✅ Changed from TouchableOpacity to Pressable
   - ✅ Added testID: `record_button`
   - ✅ Added accessibility labels
   - ✅ Testing mode disables opacity animations

2. **Button** (`src/components/ui/Button.tsx`)
   - ✅ Changed from TouchableOpacity to Pressable
   - ✅ Supports custom testID prop
   - ✅ Added accessibility attributes
   - ✅ Testing mode support

### Components Still Using TouchableOpacity (To Update)

High Priority:
- `MessageBubble.tsx` - Critical for message interaction testing
- `IconButton.tsx` - Used throughout navigation
- `VoiceMessagePlayer.tsx` - Play/pause controls
- `FriendChatScreen.tsx` - Send button and navigation

Medium Priority:
- `ExpiryRuleSelector.tsx` - Modal options
- `PremiumSecurityUpsell.tsx` - Conversion testing
- `SecurityShield.tsx` - Security features

## Test Scenarios

### 1. Screenshot Prevention Test

```javascript
// Test file: tests/screenshot-prevention.test.js

// Test Case 1: iOS Screenshot Detection
async function testIOSScreenshotDetection() {
  // 1. Launch app on iOS simulator
  await launchApp('ios');
  
  // 2. Navigate to chat
  await tap('testID:friends_tab');
  await tap('testID:friend_chat_0');
  
  // 3. Send a message
  await tap('testID:record_button');
  await wait(2000);
  await release('testID:record_button');
  
  // 4. Take screenshot
  await takeScreenshot();
  
  // 5. Verify notification sent to message owner
  await verifyNotification('Screenshot Detected!');
}

// Test Case 2: Cross-Platform Notification
async function testCrossPlatformNotification() {
  // 1. Launch on both platforms
  const iosDevice = await launchApp('ios');
  const androidDevice = await launchApp('android');
  
  // 2. Send message from iOS to Android
  await iosDevice.sendMessage('Hello from iOS');
  
  // 3. Android takes screenshot
  await androidDevice.takeScreenshot();
  
  // 4. iOS should receive notification
  await iosDevice.verifyAlert('Someone screenshotted your message');
}
```

### 2. Voice Recording Test

```javascript
// Test voice recording with new Pressable button
async function testVoiceRecording() {
  // Navigate to chat
  await tap('testID:friend_chat_0');
  
  // Start recording
  await pressIn('testID:record_button');
  await verifyState('recording', true);
  
  // Stop recording after 3 seconds
  await wait(3000);
  await pressOut('testID:record_button');
  
  // Verify message sent
  await verifyElement('testID:voice_message_0');
}
```

### 3. Premium Upsell Flow

```javascript
// Test premium conversion flow
async function testPremiumUpsell() {
  // Trigger screenshot as free user
  await takeScreenshot();
  
  // Verify upsell modal appears
  await verifyElement('testID:premium_upsell_modal');
  
  // Test upgrade button
  await tap('testID:upgrade_button');
  
  // Verify navigation to payment
  await verifyScreen('payment_screen');
}
```

## Running Tests

### Manual Testing with MCP
```bash
# Start the MCP server
npx -y @mobilenext/mobile-mcp@latest

# In Claude Code, use the mobile testing tools
# The server provides access to device control and verification
```

### Automated Test Suite
```bash
# Run all tests
npm run test:mobile

# Run specific test
npm run test:mobile -- --testNamePattern="Screenshot"

# Run on specific platform
npm run test:mobile:ios
npm run test:mobile:android
```

## TestID Naming Convention

Use hierarchical naming for easy identification:

```
screen_component_element_index

Examples:
- friendChat_messageList_bubble_0
- friendChat_recordButton
- friendChat_sendButton
- inbox_messageCard_playButton_3
- settings_themeToggle
- premium_upgradeButton
```

## Troubleshooting

### Issue: TouchableOpacity not responding in tests
**Solution**: Component has been updated to Pressable. Pull latest changes.

### Issue: Animations interfering with tests
**Solution**: Set `EXPO_PUBLIC_TESTING_MODE=true` to disable animations.

### Issue: Can't find element by testID
**Solution**: Ensure component has testID prop and it's properly passed down.

### Issue: MCP server not connecting
**Solution**: 
1. Check device/emulator is running
2. Verify ADB connection for Android
3. Ensure Xcode/Android SDK installed

### Issue: Screenshot not detected on iOS
**Solution**: Use development build, not Expo Go. Screenshot detection requires native module.

## Benefits of This Setup

1. **Faster Testing**: Automated tests run in minutes vs hours of manual testing
2. **Cross-Platform**: Test iOS ↔ Android interactions automatically
3. **Reliable**: Pressable components eliminate TouchableOpacity timing issues
4. **Comprehensive**: Test entire user flows including monetization
5. **CI/CD Ready**: Can integrate with GitHub Actions for automated testing

## Next Steps

1. **Complete Component Migration**: Update remaining TouchableOpacity components
2. **Add More TestIDs**: Cover all interactive elements
3. **Create Test Suite**: Build comprehensive automated tests
4. **CI Integration**: Set up GitHub Actions for automated testing
5. **Performance Testing**: Add performance metrics to test runs

## Resources

- [MCP Mobile Documentation](https://github.com/mobilenext/mobile-mcp)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [React Native Testing Best Practices](https://reactnative.dev/docs/testing-overview)
- [Pressable Component](https://reactnative.dev/docs/pressable)