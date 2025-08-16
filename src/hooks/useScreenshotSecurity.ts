import { useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useSecurity } from '../contexts/SecurityContext';
import { enableScreenshotPrevention, disableScreenshotPrevention } from '../modules/ScreenshotPreventModule';

interface UseScreenshotSecurityOptions {
  enabled?: boolean;
  onScreenshotDetected?: (timestamp: Date) => void;
  sensitiveContent?: boolean;
  messageId?: string;
  screenName?: string;
}

export function useScreenshotSecurity({
  enabled = true,
  onScreenshotDetected,
  sensitiveContent = false,
  messageId,
  screenName,
}: UseScreenshotSecurityOptions = {}) {
  const { 
    isSecureModeEnabled, 
    isPremiumUser, 
    recordScreenshotAttempt,
    canPreventScreenshots,
    canDetectScreenshots,
  } = useSecurity();
  
  const screenshotListenerRef = useRef<any>(null);
  const lastScreenshotTimeRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  // Debounce screenshot detection to prevent false positives
  const SCREENSHOT_DEBOUNCE_MS = 500;
  
  // Handle screenshot detection (iOS)
  const handleScreenshotDetected = useCallback(async () => {
    const now = Date.now();
    
    // ALWAYS log screenshot detection for debugging
    console.log('[Screenshot] 📸 SCREENSHOT DETECTED! Time:', new Date().toISOString());
    console.log('[Screenshot] Context:', { messageId, screenName, sensitiveContent });
    
    // Debounce rapid screenshot events
    if (now - lastScreenshotTimeRef.current < SCREENSHOT_DEBOUNCE_MS) {
      console.log('[Screenshot] Debounced - too soon after last screenshot');
      return;
    }
    
    lastScreenshotTimeRef.current = now;
    const timestamp = new Date();
    
    console.log('[Screenshot] Recording screenshot attempt for messageId:', messageId);
    
    // Record attempt in database
    await recordScreenshotAttempt(messageId, {
      screenName,
      sensitiveContent,
      timestamp: timestamp.toISOString(),
    });
    
    // Call custom handler if provided
    if (onScreenshotDetected) {
      console.log('[Screenshot] Calling custom handler');
      onScreenshotDetected(timestamp);
    }
  }, [messageId, screenName, sensitiveContent, onScreenshotDetected, recordScreenshotAttempt]);
  
  // Enable/disable screenshot prevention (Android)
  const setAndroidSecureMode = useCallback(async (secure: boolean) => {
    if (Platform.OS !== 'android') return;
    
    try {
      if (secure) {
        const success = await enableScreenshotPrevention();
        if (!success && __DEV__) {
          console.warn('[Screenshot] Failed to enable FLAG_SECURE');
        }
      } else {
        const success = await disableScreenshotPrevention();
        if (!success && __DEV__) {
          console.warn('[Screenshot] Failed to disable FLAG_SECURE');
        }
      }
    } catch (error) {
      console.error('[Screenshot] Failed to set Android secure mode:', error);
    }
  }, []); // Removed isPremiumUser dependency since screenshot prevention is now free
  
  // Setup iOS screenshot detection
  const setupIOSScreenshotDetection = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      console.log('[Screenshot] Not iOS platform, skipping setup');
      return;
    }
    
    try {
      console.log('[Screenshot] Setting up iOS screenshot detection...');
      
      // Add screenshot listener for iOS
      // Note: expo-screen-capture only provides detection, not prevention on iOS
      const subscription = ScreenCapture.addScreenshotListener(() => {
        console.log('[Screenshot] 🚨 Screenshot listener triggered!');
        handleScreenshotDetected();
      });
      
      screenshotListenerRef.current = subscription;
      
      console.log('[Screenshot] ✅ iOS screenshot detection enabled successfully');
      console.log('[Screenshot] Subscription object:', subscription);
    } catch (error) {
      console.error('[Screenshot] ❌ Failed to setup iOS screenshot detection:', error);
    }
  }, [handleScreenshotDetected]);
  
  // Cleanup iOS screenshot detection
  const cleanupIOSScreenshotDetection = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    
    if (screenshotListenerRef.current) {
      ScreenCapture.removeScreenshotListener(screenshotListenerRef.current);
      screenshotListenerRef.current = null;
      if (__DEV__) {
        console.log('[Screenshot] iOS screenshot detection disabled');
      }
    }
  }, []);
  
  // Handle app state changes (for blur overlay on iOS)
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (Platform.OS !== 'ios' || !sensitiveContent) return;
    
    if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App is going to background - could be screenshot attempt
      // Premium users get blur protection
      // This will be implemented with the blur overlay component
      if (__DEV__ && isPremiumUser) {
        console.log('[Screenshot] App backgrounded - blur overlay would activate for premium user');
      }
    }
    
    appStateRef.current = nextAppState;
  }, [sensitiveContent, isPremiumUser]);
  
  // Main effect to setup/cleanup screenshot security
  useEffect(() => {
    if (!enabled || !isSecureModeEnabled) {
      return;
    }
    
    // Setup platform-specific security
    if (Platform.OS === 'android') {
      setAndroidSecureMode(true);
    } else if (Platform.OS === 'ios') {
      setupIOSScreenshotDetection();
    }
    
    // Add app state listener for iOS blur protection
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Cleanup function
    return () => {
      if (Platform.OS === 'android') {
        setAndroidSecureMode(false);
      } else if (Platform.OS === 'ios') {
        cleanupIOSScreenshotDetection();
      }
      
      appStateSubscription.remove();
    };
  }, [
    enabled,
    isSecureModeEnabled,
    setAndroidSecureMode,
    setupIOSScreenshotDetection,
    cleanupIOSScreenshotDetection,
    handleAppStateChange,
  ]);
  
  // Public API
  return {
    isSecure: isSecureModeEnabled && enabled,
    canPrevent: canPreventScreenshots, // Removed premium requirement - free for all users
    canDetect: canDetectScreenshots,
    isPremium: isPremiumUser,
    
    // Manual controls
    enableSecurity: () => setAndroidSecureMode(true),
    disableSecurity: () => setAndroidSecureMode(false),
    
    // Utility functions
    checkSecurityStatus: () => ({
      platform: Platform.OS,
      secureModeEnabled: isSecureModeEnabled,
      premiumUser: isPremiumUser,
      screenshotPrevention: canPreventScreenshots, // Free for all users now
      screenshotDetection: canDetectScreenshots,
    }),
  };
}

// Export for use in components
export default useScreenshotSecurity;