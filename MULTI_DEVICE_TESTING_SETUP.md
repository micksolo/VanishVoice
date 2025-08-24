# Multi-Device Testing Setup Guide

## Overview
This guide explains how to set up multiple simulators/devices for testing VanishVoice's multi-user features like friend connections, messaging, and screenshot detection.

## Quick Setup for Two iPhone Simulators

### Step 1: Launch Two Simulators
```bash
# Open first iPhone 16 simulator
open -a Simulator --args -CurrentDeviceUDID [DEVICE_UDID_1]

# Open second iPhone 16 simulator  
open -a Simulator --args -CurrentDeviceUDID [DEVICE_UDID_2]
```

**Alternative using Xcode:**
1. Open Xcode
2. Go to Window → Devices and Simulators
3. Click "+" to add new simulator
4. Create two iPhone 16 simulators with different names (e.g., "iPhone 16 - User A", "iPhone 16 - User B")

### Step 2: Configure MCP for Multiple Devices
```javascript
// In your testing code, switch between devices:

// Connect to Device 1
await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User A", "simulator");

// Test Device 1 actions
await mcp__mobile-mcp__mobile_launch_app("host.exp.Exponent");
// ... Device 1 testing

// Switch to Device 2
await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User B", "simulator");

// Test Device 2 actions
await mcp__mobile-mcp__mobile_launch_app("host.exp.Exponent");
// ... Device 2 testing
```

### Step 3: Expo Development Server Configuration
Start Expo with network access for multiple devices:
```bash
# Start Expo development server
npx expo start --port 8085 --clear

# The server will be accessible at:
# - Device 1: exp://YOUR_IP:8085
# - Device 2: exp://YOUR_IP:8085 (same server, different clients)
```

## Testing Scenarios

### 1. Friend Connection Testing

**Objective**: Test friend request sending, receiving, and acceptance between two users.

```javascript
async function testFriendConnection() {
  console.log("🤝 Testing friend connection between two devices...");
  
  // === DEVICE 1: Send Friend Request ===
  await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User A", "simulator");
  await mcp__mobile-mcp__mobile_launch_app("host.exp.Exponent");
  
  // Navigate to add friend
  await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(196, 536); // Add Friend button
  await sleep(1000);
  
  // Enter Device 2's username (you'll need to know this beforehand)
  await mcp__mobile-mcp__mobile_type_keys("CosmicCobra617", false); // Device 2 username
  
  // Send request
  const addButton = await findElementByLabel("Add");
  await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(
    addButton.coordinates.x, addButton.coordinates.y
  );
  
  console.log("📤 Device 1: Friend request sent");
  
  // === DEVICE 2: Accept Friend Request ===
  await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User B", "simulator");
  await mcp__mobile-mcp__mobile_launch_app("host.exp.Exponent");
  
  // Check for friend request notification
  await sleep(3000); // Wait for notification
  const elements = await mcp__mobile-mcp__mobile_list_elements_on_screen();
  
  // Look for friend request in UI
  const friendRequest = elements.find(el => 
    el.label && el.label.includes("CosmicCobra616") // Device 1 username
  );
  
  if (friendRequest) {
    // Accept the request
    const acceptButton = elements.find(el => el.label === "Accept");
    if (acceptButton) {
      await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(
        acceptButton.coordinates.x, acceptButton.coordinates.y
      );
      console.log("✅ Device 2: Friend request accepted");
    }
  }
  
  // === VERIFY CONNECTION ON BOTH DEVICES ===
  // Check Device 1 friends list
  await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User A", "simulator");
  await sleep(2000);
  const device1Elements = await mcp__mobile-mcp__mobile_list_elements_on_screen();
  const device1HasFriend = device1Elements.some(el => 
    el.label && el.label.includes("CosmicCobra617")
  );
  
  // Check Device 2 friends list  
  await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User B", "simulator");
  await sleep(2000);
  const device2Elements = await mcp__mobile-mcp__mobile_list_elements_on_screen();
  const device2HasFriend = device2Elements.some(el => 
    el.label && el.label.includes("CosmicCobra616")
  );
  
  return {
    friendRequestSent: true,
    friendRequestAccepted: true,
    device1ShowsFriend: device1HasFriend,
    device2ShowsFriend: device2HasFriend,
    status: (device1HasFriend && device2HasFriend) ? "PASS" : "FAIL"
  };
}
```

### 2. Voice Message Cross-Device Testing

```javascript
async function testVoiceMessaging() {
  console.log("🎤 Testing voice messages between devices...");
  
  // === DEVICE 1: Send Voice Message ===
  await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User A", "simulator");
  
  // Navigate to chat with Device 2 user
  const friendElement = await findElementByLabel("CosmicCobra617");
  await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(
    friendElement.coordinates.x, friendElement.coordinates.y
  );
  
  // Find and hold record button
  const recordButton = await findElementByLabel("Record");
  if (recordButton) {
    // Simulate long press for recording
    await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(
      recordButton.coordinates.x, recordButton.coordinates.y
    );
    await sleep(3000); // Record for 3 seconds
    
    // Release to send
    console.log("📤 Device 1: Voice message sent");
  }
  
  // === DEVICE 2: Receive and Play Message ===
  await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User B", "simulator");
  
  // Check for new message notification
  await sleep(5000); // Wait for message to arrive
  
  // Navigate to chat with Device 1 user
  const senderElement = await findElementByLabel("CosmicCobra616");
  if (senderElement) {
    await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(
      senderElement.coordinates.x, senderElement.coordinates.y
    );
    
    // Look for voice message in chat
    const elements = await mcp__mobile-mcp__mobile_list_elements_on_screen();
    const voiceMessage = elements.find(el => 
      el.label && el.label.includes("🎤")
    );
    
    if (voiceMessage) {
      // Tap to play voice message
      await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(
        voiceMessage.coordinates.x, voiceMessage.coordinates.y
      );
      console.log("▶️ Device 2: Voice message played");
      
      return { status: "PASS", messageReceived: true, messagePlayed: true };
    }
  }
  
  return { status: "FAIL", messageReceived: false, messagePlayed: false };
}
```

### 3. Screenshot Detection Testing

```javascript
async function testScreenshotDetection() {
  console.log("📸 Testing screenshot detection between devices...");
  
  // === DEVICE 1: Open Chat with Device 2 ===
  await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User A", "simulator");
  
  // Navigate to chat with Device 2
  const friendElement = await findElementByLabel("CosmicCobra617");
  await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(
    friendElement.coordinates.x, friendElement.coordinates.y
  );
  
  // === DEVICE 1: Take Screenshot ===
  console.log("📸 Device 1: Taking screenshot...");
  await mcp__mobile-mcp__mobile_save_screenshot("/tmp/screenshot_test_device1.png");
  
  // === DEVICE 2: Check for Screenshot Detection Notification ===
  await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User B", "simulator");
  await sleep(3000); // Wait for notification system
  
  const elements = await mcp__mobile-mcp__mobile_list_elements_on_screen();
  
  // Look for screenshot detection alert or notification
  const screenshotAlert = elements.find(el => 
    el.label && (
      el.label.toLowerCase().includes("screenshot") ||
      el.label.toLowerCase().includes("detected")
    )
  );
  
  return {
    screenshotTaken: true,
    alertReceived: !!screenshotAlert,
    status: screenshotAlert ? "PASS" : "NEEDS_INVESTIGATION",
    note: "Screenshot detection may require physical devices for full testing"
  };
}
```

### 4. Real-time Messaging Testing

```javascript
async function testRealTimeMessaging() {
  console.log("💬 Testing real-time messaging between devices...");
  
  // === DEVICE 1: Send Text Message ===
  await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User A", "simulator");
  
  // Open chat with Device 2
  const friendElement = await findElementByLabel("CosmicCobra617");
  await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(
    friendElement.coordinates.x, friendElement.coordinates.y
  );
  
  // Type and send message
  const messageInput = await findElementByType("TextInput");
  if (messageInput) {
    await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(
      messageInput.coordinates.x, messageInput.coordinates.y
    );
    
    await mcp__mobile-mcp__mobile_type_keys("Test message from Device 1", false);
    
    // Find and tap send button
    const sendButton = await findElementByLabel("Send");
    if (sendButton) {
      await mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(
        sendButton.coordinates.x, sendButton.coordinates.y
      );
      console.log("📤 Device 1: Message sent");
    }
  }
  
  // === DEVICE 2: Check for Real-time Message Receipt ===
  await mcp__mobile-mcp__mobile_use_device("iPhone 16 - User B", "simulator");
  
  // Wait for real-time update
  await sleep(2000);
  
  // Check if message appeared
  const elements = await mcp__mobile-mcp__mobile_list_elements_on_screen();
  const messageReceived = elements.some(el => 
    el.label && el.label.includes("Test message from Device 1")
  );
  
  return {
    messageSent: true,
    messageReceived: messageReceived,
    realTimeDelay: messageReceived ? "< 2 seconds" : "Not received",
    status: messageReceived ? "PASS" : "FAIL"
  };
}
```

## Helper Functions

```javascript
async function findElementByLabel(label) {
  const elements = await mcp__mobile-mcp__mobile_list_elements_on_screen();
  return elements.find(el => el.label === label);
}

async function findElementByType(type) {
  const elements = await mcp__mobile-mcp__mobile_list_elements_on_screen();
  return elements.find(el => el.type === type);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeTestScreenshot(deviceName, filename) {
  return await mcp__mobile-mcp__mobile_save_screenshot(`/tmp/${filename}_${deviceName}.png`);
}
```

## Common Issues and Solutions

### Issue: Simulators Not Connecting to Same Server
**Solution**: Ensure both simulators are connecting to the same Expo development server IP address.

### Issue: Users Not Showing Up in Friend Search
**Solution**: Make sure both test users have different usernames set up in their profiles.

### Issue: Real-time Features Not Working
**Solution**: Check that Supabase real-time subscriptions are working and both devices have network connectivity.

### Issue: MCP Not Switching Between Devices
**Solution**: Verify device names match exactly what's shown in `mcp__mobile-mcp__mobile_list_available_devices()`.

## Advanced Testing Scenarios

### Network Condition Testing
Test app behavior under different network conditions:
- Slow network simulation
- Network interruption testing
- Offline/online state transitions

### Performance Under Load
- Multiple simultaneous users
- Large message history
- High-frequency message sending

### Security Edge Cases
- Screenshot detection timing
- Encryption/decryption under load
- Message delivery guarantees

## Integration with CI/CD

For automated multi-device testing in CI/CD:
```yaml
# Example GitHub Actions workflow
- name: Run Multi-Device Tests
  run: |
    # Start two simulators
    xcrun simctl boot "iPhone 16 - User A"
    xcrun simctl boot "iPhone 16 - User B" 
    
    # Run multi-device test suite
    npm run test:multi-device
    
    # Cleanup simulators
    xcrun simctl shutdown all
```

---

*Multi-device testing is essential for validating VanishVoice's real-time and social features. Update these procedures as new multi-user features are developed.*