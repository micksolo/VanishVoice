import { useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useSecurity } from '../contexts/SecurityContext';
import { enableScreenshotPrevention, disableScreenshotPrevention } from 'screenshot-prevent';
import { 
  createScreenshotContext, 
  detectPrimaryMessageForScreenshot, 
  messageToVisibleMessage,
  logScreenshotContext 
} from '../utils/screenshotContext';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { screenshotLog, screenshotWarn, screenshotError } from '../utils/debugConfig';

interface UseScreenshotSecurityOptions {
  enabled?: boolean;
  onScreenshotDetected?: (timestamp: Date, context?: any) => void;
  sensitiveContent?: boolean;
  messageId?: string;
  screenName?: string;
  visibleMessages?: any[]; // Array of currently visible messages
  currentlyViewingMessageId?: string; // ID of message being actively viewed/played
  friendId?: string; // ID of the friend in chat context
}

export function useScreenshotSecurity({
  enabled = true,
  onScreenshotDetected,
  sensitiveContent = false,
  messageId,
  screenName,
  visibleMessages = [],
  currentlyViewingMessageId,
  friendId,
}: UseScreenshotSecurityOptions = {}) {
  const { 
    isSecureModeEnabled, 
    isPremiumUser, 
    recordScreenshotAttempt,
    canPreventScreenshots,
    canDetectScreenshots,
  } = useSecurity();
  
  const { user } = useAuth();
  
  const screenshotListenerRef = useRef<any>(null);
  const lastScreenshotTimeRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  // Debounce screenshot detection to prevent false positives
  const SCREENSHOT_DEBOUNCE_MS = 500;
  
  // Handle screenshot detection (iOS)
  const handleScreenshotDetected = useCallback(async () => {
    const now = Date.now();
    
    // ALWAYS log screenshot detection for debugging
    screenshotLog('📸 SCREENSHOT DETECTED! Time:', new Date().toISOString());
    
    // Debounce rapid screenshot events
    if (now - lastScreenshotTimeRef.current < SCREENSHOT_DEBOUNCE_MS) {
      screenshotLog('Debounced - too soon after last screenshot');
      return;
    }
    
    lastScreenshotTimeRef.current = now;
    const timestamp = new Date();
    
    if (!user?.id) {
      screenshotLog('No user found, cannot process screenshot');
      return;
    }

    // Create comprehensive screenshot context
    const visibleMessageObjects = visibleMessages.map(messageToVisibleMessage);
    const screenshotContext = createScreenshotContext(
      visibleMessageObjects,
      user.id,
      screenName || 'unknown',
      friendId,
      currentlyViewingMessageId
    );
    
    logScreenshotContext(screenshotContext, 'Screenshot Detection');
    
    // Determine which message to report (if any)
    const primaryMessage = detectPrimaryMessageForScreenshot(
      visibleMessageObjects,
      user.id,
      currentlyViewingMessageId
    );
    
    if (primaryMessage) {
      screenshotLog('🎯 Will notify message owner:', {
        messageId: primaryMessage.id,
        messageOwner: primaryMessage.senderId,
        screenshotter: user.id,
        messageType: primaryMessage.type
      });
      
      // Record attempt in database with enhanced context
      await recordScreenshotAttempt(primaryMessage.id, {
        screenName: screenName || 'unknown',
        sensitiveContent,
        friendId,
        messageType: primaryMessage.type,
        timestamp: timestamp.toISOString(),
        context: screenshotContext.chatContext,
        visibleMessagesCount: visibleMessageObjects.length,
        currentlyViewing: currentlyViewingMessageId
      });
      
      // Call custom handler with enhanced context
      if (onScreenshotDetected) {
        screenshotLog('Calling custom handler with context');
        onScreenshotDetected(timestamp, {
          primaryMessage,
          screenshotContext,
          messageOwner: primaryMessage.senderId
        });
      }
    } else {
      screenshotLog('⚠️ No messages from other people found - screenshot will be ignored');
      screenshotLog('Context:', {
        totalMessages: visibleMessages.length,
        currentUserId: user.id,
        visibleMessages: visibleMessageObjects.map(m => ({ id: m.id, senderId: m.senderId }))
      });
      
      // Still call handler to let UI know a screenshot was taken (even if ignored)
      if (onScreenshotDetected) {
        onScreenshotDetected(timestamp, {
          ignored: true,
          reason: 'No messages from other users visible'
        });
      }
    }
  }, [
    user?.id,
    visibleMessages, 
    screenName, 
    sensitiveContent, 
    friendId,
    currentlyViewingMessageId,
    onScreenshotDetected, 
    recordScreenshotAttempt
  ]);
  
  // Enable/disable screenshot prevention (Android)
  const setAndroidSecureMode = useCallback(async (secure: boolean) => {
    if (Platform.OS !== 'android') return;
    
    try {
      if (secure) {
        const success = await enableScreenshotPrevention();
        if (!success && __DEV__) {
          screenshotWarn('Failed to enable FLAG_SECURE');
        }
      } else {
        const success = await disableScreenshotPrevention();
        if (!success && __DEV__) {
          screenshotWarn('Failed to disable FLAG_SECURE');
        }
      }
    } catch (error) {
      screenshotError('Failed to set Android secure mode:', error);
    }
  }, []); // Removed isPremiumUser dependency since screenshot prevention is now free
  
  // Setup iOS screenshot detection
  const setupIOSScreenshotDetection = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      screenshotLog('Not iOS platform, skipping setup');
      return;
    }
    
    try {
      screenshotLog('Setting up iOS screenshot detection...');
      
      // Add screenshot listener for iOS
      // Note: expo-screen-capture only provides detection, not prevention on iOS
      const subscription = ScreenCapture.addScreenshotListener(() => {
        screenshotLog('🚨 Screenshot listener triggered!');
        handleScreenshotDetected();
      });
      
      screenshotListenerRef.current = subscription;
      
      screenshotLog('✅ iOS screenshot detection enabled successfully');
      screenshotLog('Subscription object:', subscription);
    } catch (error) {
      screenshotError('❌ Failed to setup iOS screenshot detection:', error);
    }
  }, [handleScreenshotDetected]);
  
  // Cleanup iOS screenshot detection
  const cleanupIOSScreenshotDetection = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    
    if (screenshotListenerRef.current) {
      ScreenCapture.removeScreenshotListener(screenshotListenerRef.current);
      screenshotListenerRef.current = null;
      if (__DEV__) {
        screenshotLog('iOS screenshot detection disabled');
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
        screenshotLog('App backgrounded - blur overlay would activate for premium user');
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