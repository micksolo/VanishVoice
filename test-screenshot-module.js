/**
 * Test Script for Screenshot Prevention Module
 * 
 * Run this in your development app to verify the native module is working:
 * 1. Import this file in App.tsx temporarily
 * 2. Call testScreenshotModule() in a useEffect
 * 3. Check console output for results
 */

import { NativeModules, Platform } from 'react-native';

// Test the native module directly
export const testNativeModuleExists = () => {
  console.log('\n=== NATIVE MODULE EXISTENCE TEST ===');
  console.log('[TEST] Platform:', Platform.OS);
  console.log('[TEST] NativeModules.ScreenshotPrevent exists:', !!NativeModules.ScreenshotPrevent);
  
  if (NativeModules.ScreenshotPrevent) {
    console.log('[TEST] ✅ Native module found!');
    console.log('[TEST] Available methods:', Object.keys(NativeModules.ScreenshotPrevent));
  } else {
    console.log('[TEST] ❌ Native module NOT found');
  }
};

// Test the Expo module import
export const testExpoModuleImport = async () => {
  console.log('\n=== EXPO MODULE IMPORT TEST ===');
  
  try {
    const { 
      enableScreenshotPrevention, 
      disableScreenshotPrevention,
      isScreenshotPreventionEnabled,
      setScreenshotPrevention 
    } = await import('screenshot-prevent');
    
    console.log('[TEST] ✅ Expo module imported successfully');
    
    // Test iOS (should work but return false)
    if (Platform.OS === 'ios') {
      console.log('\n--- iOS Tests ---');
      const enabled = await enableScreenshotPrevention();
      console.log('[TEST] Enable result (should be false on iOS):', enabled);
      
      const status = await isScreenshotPreventionEnabled();
      console.log('[TEST] Status (should be false on iOS):', status);
      
      const disabled = await disableScreenshotPrevention();
      console.log('[TEST] Disable result (should be false on iOS):', disabled);
    }
    
    // Test Android (should work and return true)
    if (Platform.OS === 'android') {
      console.log('\n--- Android Tests ---');
      const enabled = await enableScreenshotPrevention();
      console.log('[TEST] Enable result (should be true on Android):', enabled);
      
      const status1 = await isScreenshotPreventionEnabled();
      console.log('[TEST] Status after enable (should be true):', status1);
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const disabled = await disableScreenshotPrevention();
      console.log('[TEST] Disable result (should be true on Android):', disabled);
      
      const status2 = await isScreenshotPreventionEnabled();
      console.log('[TEST] Status after disable (should be false):', status2);
      
      // Test the setScreenshotPrevention convenience function
      console.log('\n--- Testing convenience function ---');
      const setResult1 = await setScreenshotPrevention(true);
      console.log('[TEST] Set to true result:', setResult1);
      
      const setResult2 = await setScreenshotPrevention(false);
      console.log('[TEST] Set to false result:', setResult2);
    }
    
    console.log('[TEST] ✅ All expo module tests completed');
    
  } catch (error) {
    console.log('[TEST] ❌ Expo module import failed:', error);
  }
};

// Run all tests
export const testScreenshotModule = async () => {
  console.log('\n🧪 STARTING SCREENSHOT MODULE TESTS 🧪');
  
  testNativeModuleExists();
  await testExpoModuleImport();
  
  console.log('\n✅ SCREENSHOT MODULE TESTS COMPLETE ✅\n');
};

// For quick copy-paste testing in App.tsx:
export const quickTest = `
// Add this to App.tsx for quick testing:
import { testScreenshotModule } from './test-screenshot-module';

// In your component:
useEffect(() => {
  testScreenshotModule();
}, []);
`;

console.log(quickTest);