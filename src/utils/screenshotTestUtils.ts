/**
 * Test utilities for screenshot detection system
 * 
 * These utilities help validate that the screenshot detection correctly
 * identifies message owners and sends notifications to the right users.
 */

import { createScreenshotContext, detectPrimaryMessageForScreenshot, VisibleMessage } from './screenshotContext';

// Mock message data for testing
export const createMockMessage = (
  id: string,
  senderId: string,
  recipientId: string,
  type: 'text' | 'voice' | 'video' = 'text',
  timestamp = new Date()
): VisibleMessage => ({
  id,
  senderId,
  recipientId,
  type,
  timestamp
});

// Test scenarios for screenshot detection
export const testScenarios = {
  // Scenario 1: User screenshots their own message (should be ignored)
  ownMessage: {
    currentUserId: 'user1',
    messages: [
      createMockMessage('msg1', 'user1', 'user2', 'text'),
      createMockMessage('msg2', 'user1', 'user2', 'voice'),
    ],
    expectedResult: null, // Should ignore - all messages are from current user
    description: 'User screenshots their own messages - should be ignored'
  },

  // Scenario 2: User screenshots friend's message (should notify friend)
  friendMessage: {
    currentUserId: 'user1',
    messages: [
      createMockMessage('msg1', 'user1', 'user2', 'text'),
      createMockMessage('msg2', 'user2', 'user1', 'voice'), // Friend's message
      createMockMessage('msg3', 'user1', 'user2', 'text'),
    ],
    expectedResult: 'msg2', // Should report friend's message
    expectedOwner: 'user2',
    description: 'User screenshots friend\'s message - should notify friend'
  },

  // Scenario 3: User is currently viewing specific message
  currentlyViewing: {
    currentUserId: 'user1',
    currentlyViewingMessageId: 'msg2',
    messages: [
      createMockMessage('msg1', 'user2', 'user1', 'text'),
      createMockMessage('msg2', 'user2', 'user1', 'video'), // Currently viewing
      createMockMessage('msg3', 'user2', 'user1', 'voice'),
    ],
    expectedResult: 'msg2', // Should prioritize currently viewing message
    expectedOwner: 'user2',
    description: 'User screenshots while viewing specific message - should prioritize that message'
  },

  // Scenario 4: Mixed conversation with priority to most recent other message
  mixedConversation: {
    currentUserId: 'user1',
    messages: [
      createMockMessage('msg1', 'user2', 'user1', 'text', new Date('2024-01-01T10:00:00Z')),
      createMockMessage('msg2', 'user1', 'user2', 'text', new Date('2024-01-01T10:01:00Z')),
      createMockMessage('msg3', 'user2', 'user1', 'voice', new Date('2024-01-01T10:02:00Z')), // Most recent from other
      createMockMessage('msg4', 'user1', 'user2', 'text', new Date('2024-01-01T10:03:00Z')),
    ],
    expectedResult: 'msg3', // Should pick most recent from other person
    expectedOwner: 'user2',
    description: 'Mixed conversation - should pick most recent message from other person'
  }
};

/**
 * Run a test scenario and validate the results
 */
export function runTestScenario(scenarioName: string, scenario: any): boolean {
  console.log(`\n[Screenshot Test] Running: ${scenario.description}`);
  
  const result = detectPrimaryMessageForScreenshot(
    scenario.messages,
    scenario.currentUserId,
    scenario.currentlyViewingMessageId
  );

  const success = result?.id === scenario.expectedResult;
  
  console.log(`[Screenshot Test] Expected: ${scenario.expectedResult}, Got: ${result?.id || 'null'}`);
  
  if (result && scenario.expectedOwner) {
    const ownerMatch = result.senderId === scenario.expectedOwner;
    console.log(`[Screenshot Test] Expected owner: ${scenario.expectedOwner}, Got: ${result.senderId}`);
    console.log(`[Screenshot Test] ${scenarioName}: ${success && ownerMatch ? '✅ PASS' : '❌ FAIL'}`);
    return success && ownerMatch;
  } else {
    console.log(`[Screenshot Test] ${scenarioName}: ${success ? '✅ PASS' : '❌ FAIL'}`);
    return success;
  }
}

/**
 * Run all test scenarios
 */
export function runAllTests(): void {
  console.log('[Screenshot Test] 🧪 Running screenshot detection tests...');
  
  let passed = 0;
  let total = 0;
  
  for (const [name, scenario] of Object.entries(testScenarios)) {
    total++;
    if (runTestScenario(name, scenario)) {
      passed++;
    }
  }
  
  console.log(`\n[Screenshot Test] Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('[Screenshot Test] 🎉 All tests passed! Screenshot detection is working correctly.');
  } else {
    console.log('[Screenshot Test] ⚠️ Some tests failed. Review screenshot detection logic.');
  }
}

/**
 * Test screenshot context creation
 */
export function testScreenshotContext(): void {
  console.log('\n[Screenshot Test] 🔍 Testing screenshot context creation...');
  
  const scenario = testScenarios.mixedConversation;
  const context = createScreenshotContext(
    scenario.messages,
    scenario.currentUserId,
    'TestScreen',
    'user2'
  );
  
  console.log('[Screenshot Test] Context created:', {
    screenName: context.screenName,
    totalMessages: context.visibleMessages.length,
    primaryMessage: context.primaryMessageId,
    friendId: context.friendId
  });
  
  console.log('[Screenshot Test] ✅ Context creation test completed');
}