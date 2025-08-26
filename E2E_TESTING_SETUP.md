# VanishVoice E2E Testing Setup

## Overview
VanishVoice currently uses **Manual Testing** as the primary E2E testing strategy. The app includes comprehensive manual testing procedures and automated encryption testing.

## Testing Infrastructure

### Manual Testing (Primary)
The app uses comprehensive manual testing procedures documented in:
- **`/MANUAL_TESTING_CHECKLIST.md`** - Complete 300+ point checklist covering all features
- **`/docs/testing/EPHEMERAL_MESSAGE_TESTING_GUIDE.md`** - Ephemeral message testing procedures  
- **`/docs/testing/PUSH_NOTIFICATION_TEST_CHECKLIST.md`** - Push notification testing
- **`/docs/troubleshooting/PUSH_NOTIFICATIONS_TESTING.md`** - Push notification troubleshooting

### Automated Unit Testing
Jest is configured for unit testing with the following setup:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch", 
    "test:coverage": "jest --coverage"
  }
}
```

**Existing Test Files:**
- `/src/utils/__tests__/e2e_encryption_audit.test.ts` - E2E encryption testing
- `/src/utils/__tests__/encryption.test.ts` - Encryption unit tests
- `/src/utils/testE2E.ts` - E2E encryption verification utilities
- `/src/utils/testE2EDetailed.ts` - Detailed E2E encryption tests

### Runtime Testing Tools
The app includes runtime testing utilities accessible in development builds:

**Profile Screen Debug Options** (Development only):
- Test E2E Encryption - Verifies text message encryption
- Detailed E2E Test - Complete encryption verification
- Test Push Notification - Verifies notification system
- Verify Voice E2E Encryption - Tests voice message security

**Realtime Debugger** (Development only):
- Connection status monitoring
- Database subscription testing  
- Real-time event verification

## Testing Strategy

### 1. Manual Testing Workflow
The primary testing approach follows this workflow:

1. **Feature Development** → Run relevant manual test sections
2. **Bug Fixes** → Execute focused regression testing  
3. **Sprint Completion** → Full manual testing checklist
4. **Release Preparation** → Complete security and performance verification

### 2. Automated Testing Coverage
**What's Automated:**
- ✅ E2E encryption verification
- ✅ Crypto utility functions
- ✅ Push notification delivery  
- ✅ Real-time connection status

**What Requires Manual Testing:**
- UI/UX interactions
- Cross-device messaging
- Platform-specific behaviors
- Media recording/playback
- Network failure scenarios

### 3. Security Testing
**Encryption Verification (Automated):**
```bash
npm test # Runs encryption test suite
```

**Runtime Encryption Testing:**
1. Open Profile → Debug → "Test E2E Encryption"
2. Verify database shows encrypted content only
3. Confirm voice/video messages use encrypted URLs

### 4. Platform Testing
**iOS Testing:**
- Physical device testing required for push notifications
- Silent mode audio playback verification
- Camera/microphone permission flows

**Android Testing:**  
- Background notification delivery
- Navigation bar interaction
- Storage permission handling

## MCP Mobile Testing Support

The project includes **MCP Mobile Testing** infrastructure for device automation:

**Setup Files:**
- `/MOBILE_TESTING_PLAYBOOK.md` - Complete mobile testing procedures
- `/MOBILE_TEST_SUITES.md` - Organized test suites  
- `/MCP_MOBILE_TESTING_SETUP.md` - MCP configuration
- `/MULTI_DEVICE_TESTING_SETUP.md` - Multi-device testing
- `/PERFORMANCE_BASELINES.md` - Performance benchmarks

**MCP Commands Available:**
```bash
# Launch app for testing
mcp__mobile-mcp__mobile_launch_app("host.exp.Exponent")

# Visual verification
mcp__mobile-mcp__mobile_take_screenshot()

# Interaction testing  
mcp__mobile-mcp__mobile_list_elements_on_screen()
mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(x, y)
```

## Running Tests

### Manual Testing
1. Follow `/MANUAL_TESTING_CHECKLIST.md` procedures
2. Use development build for debug features
3. Test on both iOS and Android

### Automated Testing
```bash
# Run all unit tests
npm test

# Run with coverage
npm test:coverage  

# Watch mode for development
npm test:watch
```

### MCP Mobile Testing
1. Configure MCP mobile server in `~/.claude.json`
2. Use iPhone SE 3rd generation simulator (iOS)
3. Use emulator-5554 (Android)
4. Follow `/MOBILE_TESTING_PLAYBOOK.md` procedures

## Test Environment Requirements

### Development Dependencies
- Jest 29.7.0 (unit testing)
- TypeScript testing support  
- @types/jest for type safety

### Device Requirements
- iOS: iPhone SE 3rd gen simulator or physical device
- Android: API level 30+ emulator or physical device
- Push notification testing requires physical devices

### Network Requirements  
- Supabase backend connectivity
- Real-time subscription testing
- Push notification service access

## Future E2E Testing Considerations

### Potential Automation Frameworks
If automated E2E testing becomes necessary:

**React Native Options:**
- **Detox** - React Native E2E testing framework
- **Appium** - Cross-platform mobile automation
- **Maestro** - Mobile UI testing tool

**Implementation Considerations:**
- Cross-platform test maintenance
- Media testing complexity (camera/audio)
- Real-time messaging test coordination
- Anonymous matching test scenarios

### Current Manual Testing Benefits
- **Complete Coverage**: 300+ test points cover all features
- **Platform Specific**: Tests iOS/Android differences explicitly  
- **Real User Scenarios**: Tests actual user workflows
- **Flexible**: Easy to adapt when features change
- **Security Focus**: Manual verification of encryption

## Conclusion

VanishVoice's current manual testing approach provides comprehensive coverage while maintaining development velocity. The combination of manual procedures, automated unit tests, and MCP mobile testing tools creates a robust testing strategy suitable for the app's anonymous messaging requirements.

**For immediate use:**
1. Follow `MANUAL_TESTING_CHECKLIST.md` for complete feature testing
2. Use Profile Debug tools for encryption verification
3. Implement MCP mobile testing for regression automation
4. Maintain Jest unit tests for crypto functionality