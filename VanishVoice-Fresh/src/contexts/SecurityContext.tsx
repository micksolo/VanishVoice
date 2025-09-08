import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useAuth } from './AnonymousAuthContext';
import { sendScreenshotNotification } from '../services/pushNotifications';

// Types
interface ScreenshotAttempt {
  id: string;
  userId: string;
  messageId?: string;
  platform: 'ios' | 'android';
  detectedAt: Date;
  context?: {
    screenName?: string;
    chatId?: string;
    messageType?: 'text' | 'voice' | 'video';
  };
}

// Security verification levels
type SecurityLevel = 'silent' | 'informed' | 'paranoid';

interface SecurityContextType {
  // Security state
  isSecureModeEnabled: boolean;
  isPremiumUser: boolean;
  screenshotAttempts: ScreenshotAttempt[];
  securityLevel: SecurityLevel;
  
  // Platform-specific capabilities
  canPreventScreenshots: boolean; // Android only
  canDetectScreenshots: boolean; // iOS only
  
  // Actions
  enableSecureMode: () => Promise<void>;
  disableSecureMode: () => Promise<void>;
  setSecurityLevel: (level: SecurityLevel) => Promise<void>;
  recordScreenshotAttempt: (messageId?: string, context?: any) => Promise<void>;
  getScreenshotHistory: () => Promise<ScreenshotAttempt[]>;
  clearSecurityData: () => Promise<void>;
  
  // Verification helpers
  shouldShowVerificationModal: () => boolean;
  shouldShowSecurityNotification: () => boolean;
  getSecurityDescription: (level: SecurityLevel) => string;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

const SECURITY_STORAGE_KEY = '@wyd_security_preferences';
const PREMIUM_STATUS_KEY = '@wyd_premium_status';

export function SecurityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isSecureModeEnabled, setIsSecureModeEnabled] = useState(true); // Default to secure
  const [isPremiumUser, setIsPremiumUser] = useState(true); // Make screenshot prevention free for all users
  const [screenshotAttempts, setScreenshotAttempts] = useState<ScreenshotAttempt[]>([]);
  const [securityLevel, setSecurityLevelState] = useState<SecurityLevel>('silent'); // Default to silent for better UX
  
  // Platform capabilities
  const canPreventScreenshots = Platform.OS === 'android';
  const canDetectScreenshots = Platform.OS === 'ios';
  
  // Load security preferences on mount
  useEffect(() => {
    loadSecurityPreferences();
    checkPremiumStatus();
  }, [user]);
  
  const loadSecurityPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(SECURITY_STORAGE_KEY);
      if (stored) {
        const preferences = JSON.parse(stored);
        setIsSecureModeEnabled(preferences.secureModeEnabled ?? true);
        setSecurityLevelState(preferences.securityLevel ?? 'silent');
      }
    } catch (error) {
      console.error('[Security] Failed to load preferences:', error);
    }
  };
  
  const checkPremiumStatus = async () => {
    // Screenshot prevention is now free for all users (like Snapchat)
    // No need to check premium status for screenshot blocking
    setIsPremiumUser(true);
    
    /* DISABLED: Premium subscription checking
    try {
      // For now, check local storage. Later integrate with payment system
      const status = await AsyncStorage.getItem(PREMIUM_STATUS_KEY);
      setIsPremiumUser(status === 'true');
      
      // TODO: Check actual subscription status from backend
      if (user) {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('status')
          .eq('user_id', user.id)
          .single();
        
        if (data && !error) {
          setIsPremiumUser(data.status === 'active');
        }
      }
    } catch (error) {
      console.error('[Security] Failed to check premium status:', error);
    }
    */
  };
  
  const enableSecureMode = async () => {
    try {
      setIsSecureModeEnabled(true);
      
      // Save preference
      await AsyncStorage.setItem(
        SECURITY_STORAGE_KEY,
        JSON.stringify({ 
          secureModeEnabled: true,
          securityLevel 
        })
      );
      
      // Platform-specific secure mode activation
      // Android FLAG_SECURE and iOS detection handled by useScreenshotSecurity hook
    } catch (error) {
      console.error('[Security] Failed to enable secure mode:', error);
      Alert.alert('Error', 'Failed to enable secure mode');
    }
  };
  
  const disableSecureMode = async () => {
    try {
      // Show warning before disabling
      Alert.alert(
        'Disable Security?',
        'This will allow screenshots and screen recording. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              setIsSecureModeEnabled(false);
              
              await AsyncStorage.setItem(
                SECURITY_STORAGE_KEY,
                JSON.stringify({ 
                  secureModeEnabled: false,
                  securityLevel 
                })
              );
            },
          },
        ]
      );
    } catch (error) {
      console.error('[Security] Failed to disable secure mode:', error);
    }
  };
  
  const recordScreenshotAttempt = async (messageId?: string, context?: any) => {
    console.log('[Security] 🔴 recordScreenshotAttempt called with:', { messageId, context, userId: user?.id });
    
    try {
      if (!user) {
        console.log('[Security] No user found, cannot record screenshot');
        return;
      }
      
      const attempt: ScreenshotAttempt = {
        id: `${Date.now()}-${Math.random()}`,
        userId: user.id,
        messageId,
        platform: Platform.OS as 'ios' | 'android',
        detectedAt: new Date(),
        context,
      };
      
      console.log('[Security] Created screenshot attempt:', attempt);
      
      // Update local state
      setScreenshotAttempts(prev => [...prev, attempt]);
      
      // Log to database and notify the MESSAGE SENDER (not the screenshotter)
      if (Platform.OS === 'ios' && messageId) {
        console.log('[Security] iOS screenshot with messageId, fetching message info...');
        // First, get the message to find out who sent it
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .select('sender_id, recipient_id')
          .eq('id', messageId)
          .single();
        
        console.log('[Security] Message query result:', { messageData, messageError });
        
        if (messageError) {
          console.error('[Security] Failed to get message info:', messageError);
          return;
        }
        
        // Determine who should be notified (the message sender, not the screenshotter)
        const messageOwnerId = messageData.sender_id;
        const isMyMessage = messageOwnerId === user.id;
        
        console.log('[Security] 🎯 Screenshot notification logic:', {
          messageId,
          messageSender: messageOwnerId,
          screenshotter: user.id,
          isMyOwnMessage: isMyMessage,
          willNotifySender: !isMyMessage
        });
        
        // Log the screenshot attempt
        console.log('[Security] Inserting screenshot attempt to database...');
        const { data: insertedData, error } = await supabase
          .from('screenshot_attempts')
          .insert({
            user_id: user.id, // Who took the screenshot
            message_id: messageId,
            platform: Platform.OS,
            detected_at: attempt.detectedAt.toISOString(),
            context: {
              ...context,
              message_owner_id: messageOwnerId,
              screenshotter_id: user.id,
            },
          })
          .select();
        
        if (error) {
          console.error('[Security] ❌ Failed to log screenshot attempt:', error);
          console.error('[Security] Error details:', error.message, error.details);
        } else {
          console.log('[Security] ✅ Screenshot logged to database:', insertedData);
        }
        
        // IMPORTANT: Don't show alert to the person taking the screenshot!
        // The notification should go to the MESSAGE OWNER, not the screenshotter.
        
        // Notify the message owner (only if they're not the one taking the screenshot)
        if (!isMyMessage) {
          try {
            // Send push notification to message owner
            await sendScreenshotNotification(messageOwnerId, user.id, messageId);
            
            console.log('[Security] Screenshot notification sent to message owner:', messageOwnerId);
            
            // Send real-time notification via Supabase using service role function
            // This ensures immediate delivery across devices
            try {
              const { data: notificationData, error: realtimeError } = await supabase
                .rpc('send_cross_device_notification', {
                  p_user_id: messageOwnerId,
                  p_type: 'screenshot_detected',
                  p_title: 'Screenshot Detected 📸',
                  p_body: 'Someone took a screenshot of your message',
                  p_data: {
                    screenshotter_id: user.id,
                    message_id: messageId,
                    screenshot_time: new Date().toISOString(),
                    context: context || {}
                  }
                });
              
              if (realtimeError) {
                console.error('[Security] Failed to send cross-device notification:', realtimeError);
                console.error('[Security] Error details:', realtimeError.message);
              } else {
                console.log('[Security] ✅ Cross-device notification sent successfully');
                console.log('[Security] Notification ID:', notificationData);
              }
            } catch (notificationError) {
              console.error('[Security] Exception sending cross-device notification:', notificationError);
            }
          } catch (notificationError) {
            console.error('[Security] Failed to send screenshot notification:', notificationError);
          }
        }
        
        if (__DEV__) {
          console.log('[Security] Screenshot detected:', {
            messageOwner: messageOwnerId,
            screenshotter: user.id,
            isMyMessage,
            shouldNotifyOwner: !isMyMessage,
            notificationSent: !isMyMessage
          });
        }
      }
    } catch (error) {
      console.error('[Security] Failed to record screenshot attempt:', error);
    }
  };
  
  const getScreenshotHistory = async (): Promise<ScreenshotAttempt[]> => {
    try {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('screenshot_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('detected_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('[Security] Failed to fetch screenshot history:', error);
        return screenshotAttempts; // Return local cache
      }
      
      const attempts: ScreenshotAttempt[] = (data || []).map(item => ({
        id: item.id,
        userId: item.user_id,
        messageId: item.message_id,
        platform: item.platform,
        detectedAt: new Date(item.detected_at),
        context: item.context,
      }));
      
      setScreenshotAttempts(attempts);
      return attempts;
    } catch (error) {
      console.error('[Security] Failed to get screenshot history:', error);
      return [];
    }
  };
  
  const clearSecurityData = async () => {
    try {
      setScreenshotAttempts([]);
      await AsyncStorage.removeItem(SECURITY_STORAGE_KEY);
      
      // Don't clear premium status as it's tied to subscription
    } catch (error) {
      console.error('[Security] Failed to clear security data:', error);
    }
  };

  const setSecurityLevel = async (level: SecurityLevel) => {
    try {
      setSecurityLevelState(level);
      
      // Save preference
      await AsyncStorage.setItem(
        SECURITY_STORAGE_KEY,
        JSON.stringify({
          secureModeEnabled: isSecureModeEnabled,
          securityLevel: level
        })
      );
      
      console.log(`[Security] Security level changed to: ${level}`);
    } catch (error) {
      console.error('[Security] Failed to set security level:', error);
      Alert.alert('Error', 'Failed to update security settings');
    }
  };

  // Helper functions for UX decisions
  const shouldShowVerificationModal = (): boolean => {
    return securityLevel === 'paranoid';
  };

  const shouldShowSecurityNotification = (): boolean => {
    return securityLevel === 'informed' || securityLevel === 'paranoid';
  };

  const getSecurityDescription = (level: SecurityLevel): string => {
    switch (level) {
      case 'silent':
        return 'Silent protection - security runs in the background without interrupting your chats. You\'ll only be notified if something goes wrong.';
      case 'informed':
        return 'Informed protection - see security status and optional verification for each chat. Balanced security with minimal friction.';
      case 'paranoid':
        return 'Maximum protection - full emoji verification required before each anonymous chat. Highest security but requires coordination with chat partners.';
      default:
        return '';
    }
  };
  
  const value: SecurityContextType = {
    isSecureModeEnabled,
    isPremiumUser,
    screenshotAttempts,
    securityLevel,
    canPreventScreenshots,
    canDetectScreenshots,
    enableSecureMode,
    disableSecureMode,
    setSecurityLevel,
    recordScreenshotAttempt,
    getScreenshotHistory,
    clearSecurityData,
    shouldShowVerificationModal,
    shouldShowSecurityNotification,
    getSecurityDescription,
  };
  
  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}

// Custom hook to use security context
export function useSecurity() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}

// Export types
export type { ScreenshotAttempt, SecurityContextType, SecurityLevel };