import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Pressable,
  TouchableWithoutFeedback,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { 
  LongPressGestureHandler, 
  State, 
  HandlerStateChangeEvent,
  PanGestureHandler,
  GestureHandlerRootView
} from 'react-native-gesture-handler';
import { sendMessageNotification } from '../services/pushNotifications';
import { useFocusEffect } from '@react-navigation/native';
import FriendEncryption from '../utils/friendEncryption';
import SecureDeviceKeys from '../utils/SecureDeviceKeys';
import { uploadE2EEncryptedAudio, downloadAndDecryptE2EAudio } from '../utils/secureE2EAudioStorage';
import { SecureE2EVideoStorageFastAndroid } from '../utils/secureE2EVideoStorageFastAndroid';
import { EphemeralMessageService } from '../services/ephemeralMessages';
import { ExpiryRule, Message as DBMessage } from '../types/database';
import RecordingModal from '../components/RecordingModal';
import VideoRecordingModal from '../components/VideoRecordingModalNew';
import VideoPlayerModal from '../components/VideoPlayerModal';
import EphemeralIndicator from '../components/EphemeralIndicator';
import EphemeralHeaderToggle from '../components/EphemeralHeaderToggle';
import ExpiryRuleSelector from '../components/ExpiryRuleSelector';
import MessageBubble from '../components/MessageBubble';
import VoiceMessagePlayer from '../components/VoiceMessagePlayer';
import EphemeralMessageBubble from '../components/EphemeralMessageBubble';
import { useAppTheme } from '../contexts/ThemeContext';
import * as FileSystem from 'expo-file-system';
import { Video, ResizeMode } from 'expo-av';
// SHELVED: Screenshot prevention feature
// import SecureScreen from '../components/SecureScreen';
// import SecurityShield from '../components/SecurityShield';
// import { useSecurity } from '../contexts/SecurityContext';
// import useScreenshotSecurity from '../hooks/useScreenshotSecurity';
// import SecurityNotificationManagerEnhanced from '../components/SecurityNotificationManagerEnhanced';
import * as Notifications from 'expo-notifications';
// import { console.log, console.error, // screenshotLog // SHELVED: Screenshot prevention feature, // screenshotWarn // SHELVED: Screenshot prevention feature } from '../utils/debugConfig'; // SHELVED: Screenshot prevention feature
// import * as ScreenCapture from 'expo-screen-capture'; // SHELVED: Screenshot prevention feature
import messageClearingService from '../services/messageClearingService';
import { filterExpiredMessages, areMessageArraysEquivalent } from '../utils/messageFiltering';
import { computeMessageStatus } from '../utils/messageStatus';
import ViewOnceMessageManager from '../services/ViewOnceMessageManager';
import ViewOnceClearingDebugger from '../utils/debugViewOnceClearing';
import { MessageStatusService, MessageStatus } from '../services/MessageStatusService';
import ViewOnceUIManager from '../services/ViewOnceUIManager';
// import EnhancedReadReceipt from '../components/EnhancedReadReceipt'; // Temporarily disabled due to migration issues

// Debug flags now controlled by debugConfig.ts
// Use console.log('READ_RECEIPTS', message) and console.log('CHAT', message) instead

// Storage key for persisting user's privacy preference
const PRIVACY_PREFERENCE_KEY = '@wyd_privacy_preference';

interface Message {
  id: string;
  type: 'text' | 'voice' | 'video';
  content: string;
  isMine: boolean;
  timestamp: Date;
  status?: MessageStatus;
  duration?: number; // Duration in seconds for voice/video messages
  uploadProgress?: number; // Upload progress percentage
  expiryRule?: ExpiryRule; // Expiry rule for ephemeral messages
  isEphemeral?: boolean; // Whether message is ephemeral
  timeRemaining?: number; // Time remaining until expiry (milliseconds)
  hasBeenViewed?: boolean; // For sender to know when recipient viewed message
  sender_id?: string; // ID of the user who sent this message
  recipient_id?: string; // ID of the user who should receive this message
  senderCleared?: boolean; // Whether sender has cleared this view-once message
  recipientCleared?: boolean; // Whether recipient has cleared this view-once message
}

const PAGE_SIZE = 20;

// PERFORMANCE OPTIMIZATION: Check if messages have meaningful changes to avoid unnecessary re-renders
const hasMessageChanges = (dbMessages: any[], currentMessages: Message[], userId: string): boolean => {
  // Quick checks first
  if (dbMessages.length !== currentMessages.length) {
    return true; // Message count changed
  }
  
  // Check for read status changes (most common update during polling)
  for (let i = 0; i < dbMessages.length; i++) {
    const dbMsg = dbMessages[i];
    const currentMsg = currentMessages[i];
    
    if (!currentMsg || dbMsg.id !== currentMsg.id) {
      return true; // Message ID mismatch or missing
    }
    
    // Check for read status changes for messages I sent
    if (dbMsg.sender_id === userId) {
      const dbReadStatus = dbMsg.read_at ? 'read' : (dbMsg.created_at ? 'sent' : 'sending');
      const currentReadStatus = currentMsg.status;
      
      if (dbReadStatus !== currentReadStatus) {
        console.log(`[Polling Optimization] Read status changed for message ${dbMsg.id}: ${currentReadStatus} → ${dbReadStatus}`);
        return true; // Read status changed
      }
    }
    
    // Check for other important field changes
    if (dbMsg.viewed_at !== (currentMsg.hasBeenViewed ? 'viewed' : null) ||
        JSON.stringify(dbMsg.expiry_rule) !== JSON.stringify(currentMsg.expiryRule)) {
      return true; // Other status changed
    }
  }
  
  return false; // No meaningful changes detected
};

// Basic read receipt function - simple database update
const markMessageAsRead = async (messageId: string) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);
    
    if (error) {
      console.error('[MarkAsRead] Database error:', error);
      throw error;
    }
    
    console.log('[MarkAsRead] Successfully updated database for message:', messageId);
  } catch (error) {
    console.error('[MarkAsRead] Failed to mark message as read:', error);
    throw error;
  }
};

export default function FriendChatScreen({ route, navigation }: any) {
  const { friendId, friendName, friendUsername } = route.params;
  const { user } = useAuth();
  const theme = useAppTheme();
  
  // Initialize zero-knowledge encryption for this friendship
  useEffect(() => {
    if (!user?.id) return;
    
    const initializeEncryption = async () => {
      try {
        console.log('[FriendChat] Initializing zero-knowledge encryption...');
        await FriendEncryption.initializeOrRepairFriendship(user.id, friendId);
        console.log('[FriendChat] Zero-knowledge encryption ready!');
      } catch (error) {
        console.error('[FriendChat] Failed to initialize encryption:', error);
        // Don't block the UI - encryption will be retried when needed
      }
    };
    
    initializeEncryption();
  }, [user?.id, friendId]);
  
  // Track currently playing/viewing message for screenshot detection context
  const [currentlyViewingMessageId, setCurrentlyViewingMessageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // IMMEDIATE MESSAGE REMOVAL for view-once clearing
  const handleViewOnceMessageCleared = (messageId: string) => {
    console.log(`[FriendChatScreen] 🚀 Removing view-once message from local UI immediately: ${messageId}`);
    
    // Immediate UI update with smooth animation
    setMessages(prevMessages => {
      // First, mark message as clearing to trigger animation
      const updatedMessages = prevMessages.map(msg => 
        msg.id === messageId 
          ? { ...msg, isClearing: true, opacity: 0.3 } as Message & { isClearing?: boolean; opacity?: number }
          : msg
      );
      
      // Remove completely after brief animation delay
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        console.log(`[FriendChatScreen] ✅ View-once message ${messageId} removed from UI after animation`);
      }, 300); // Short animation duration
      
      return updatedMessages;
    });
  };
  
  // SHELVED: Screenshot prevention feature
  // Working screenshot detection with proper notification logic
  // const { recordScreenshotAttempt } = useSecurity();
  
  // Listen for screenshot notifications (when someone screenshots OUR messages)
  useEffect(() => {
    if (!user?.id) return;
    
    // SHELVED: Screenshot prevention feature
    // // screenshotLog // SHELVED: Screenshot prevention feature('Setting up notification listener for user:', user.id);
    
    // Poll for screenshot attempts as a fallback
    const checkForScreenshots = async () => {
      const { data, error } = await supabase
        .from('screenshot_attempts')
        .select('*')
        .or(`context->>message_owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        const latestScreenshot = data[0];
        const screenshotTime = new Date(latestScreenshot.created_at || latestScreenshot.detected_at);
        const now = new Date();
        const timeDiff = now.getTime() - screenshotTime.getTime();
        
        // If screenshot was taken in last 10 seconds, show alert
        if (timeDiff < 10000) {
          // screenshotLog // SHELVED: Screenshot prevention feature('🚨 Recent screenshot detected via polling!', latestScreenshot);
          
          Alert.alert(
            'Screenshot Detected! 📸',
            'Someone just took a screenshot of your message.',
            [
              { text: 'OK', style: 'default' },
              { text: 'Upgrade to Premium', style: 'default', onPress: () => console.log('Premium upgrade tapped') }
            ]
          );
        }
      }
    };
    
    // Check immediately and then every 3 seconds
    checkForScreenshots();
    // DISABLED FOR DEBUG: const pollInterval = setInterval(checkForScreenshots, 3000);
    
    // Listen for real-time notifications using the notifications table
    const notificationSubscription = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // screenshotLog // SHELVED: Screenshot prevention feature('Real-time notification received:', payload);
          
          const notification = payload.new;
          if (notification && notification.type === 'screenshot_detected') {
            // screenshotLog // SHELVED: Screenshot prevention feature('🚨 Someone screenshotted YOUR message!');
            
            // Show immediate alert to message owner
            Alert.alert(
              'Screenshot Detected! 📸',
              'Someone just took a screenshot of your message.',
              [
                { text: 'OK', style: 'default' },
                { 
                  text: 'View Details', 
                  style: 'default', 
                  onPress: () => {
                    // screenshotLog // SHELVED: Screenshot prevention feature('Show security details');
                    // Could navigate to security screen in future
                  }
                }
              ]
            );
            
            // Mark notification as read
            supabase
              .from('notifications')
              .update({ read: true })
              .eq('id', notification.id)
              .then(({ error }) => {
                if (error) {
                  console.error('[Screenshot] Failed to mark notification as read:', error);
                }
              });
          }
        }
      )
      .subscribe((status) => {
        // screenshotLog // SHELVED: Screenshot prevention feature('Notification subscription status:', status);
      });
    
    // Also subscribe to screenshot attempts table for fallback
    const screenshotSubscription = supabase
      .channel(`screenshot-attempts-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'screenshot_attempts',
        },
        (payload) => {
          // screenshotLog // SHELVED: Screenshot prevention feature('Screenshot attempt logged:', payload);
          
          // Check if this screenshot is for our messages (fallback method)
          const context = payload.new?.context;
          if (context && context.message_owner_id === user.id) {
            // screenshotLog // SHELVED: Screenshot prevention feature('📸 Fallback detection: Screenshot of your message detected');
          }
        }
      )
      .subscribe((status) => {
        // screenshotLog // SHELVED: Screenshot prevention feature('Screenshot attempts subscription status:', status);
      });
    
    return () => {
      // SHELVED: Screenshot prevention feature - pollInterval commented out
      // clearInterval(pollInterval);
      notificationSubscription.unsubscribe();
      screenshotSubscription.unsubscribe();
    };
  }, [user?.id]);
  
  // SHELVED: Screenshot prevention feature
  // Enhanced screenshot detection using the improved hook
  // const screenshotSecurity = useScreenshotSecurity({
  //   enabled: Platform.OS === 'ios', // Only enable on iOS for detection
  //   sensitiveContent: true,
  //   screenName: 'FriendChat',
  //   visibleMessages: messages, // Pass all currently visible messages
  //   currentlyViewingMessageId: currentlyViewingMessageId,
  //   friendId: friendId,
  //   onScreenshotDetected: (timestamp, context) => {
  //     // screenshotLog // SHELVED: Screenshot prevention feature('Enhanced screenshot detected:', {
  //       timestamp,
  //       context,
  //       ignored: context?.ignored
  //     });
  //     
  //     if (context?.ignored) {
  //       // screenshotLog // SHELVED: Screenshot prevention feature('Screenshot ignored:', context.reason);
  //     } else if (context?.primaryMessage) {
  //       // screenshotLog // SHELVED: Screenshot prevention feature('✅ Screenshot notification will be sent to:', context.messageOwner);
  //     }
  //   }
  // });
  
  const [inputText, setInputText] = useState('');
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [currentVideoUri, setCurrentVideoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<{ [key: string]: { isPlaying: boolean; progress: number; duration: number } }>({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploadingMessageId, setUploadingMessageId] = useState<string | null>(null);
  const [downloadingMessageId, setDownloadingMessageId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [swipeX] = useState(new Animated.Value(0));
  const [shouldCancel, setShouldCancel] = useState(false);
  const [micScale] = useState(new Animated.Value(1));
  const [micPulse] = useState(new Animated.Value(1));
  const [waveformAnimations] = useState(() => 
    Array.from({ length: 15 }, () => new Animated.Value(Math.random()))
  );
  const [recordButtonGlow] = useState(new Animated.Value(0));
  const [showExpirySelector, setShowExpirySelector] = useState(false);
  const [currentExpiryRule, setCurrentExpiryRule] = useState<ExpiryRule>({ type: 'view', disappear_after_view: true });
  const [privacyPreferenceLoaded, setPrivacyPreferenceLoaded] = useState(false);
  const [messageTypeForExpiry, setMessageTypeForExpiry] = useState<'text' | 'voice' | 'video'>('text');
  
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const messagePollingInterval = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const lastMessageCount = useRef<number>(0);
  const isRecordingRef = useRef<boolean>(false);
  const statusUpdateTimers = useRef<{ [messageId: string]: NodeJS.Timeout }>({});
  
  // Helper function to clear both playing message and viewing context for screenshot detection
  const clearPlayingAndViewingMessage = () => {
    setPlayingMessageId(null);
    setCurrentlyViewingMessageId(null);
  };
  
  // Read receipts system temporarily disabled due to migration issues
  // Load user's privacy preference on component mount
  useEffect(() => {
    const loadPrivacyPreference = async () => {
      try {
        const storedPreference = await AsyncStorage.getItem(PRIVACY_PREFERENCE_KEY);
        
        if (storedPreference) {
          const parsedPreference = JSON.parse(storedPreference) as ExpiryRule;
          setCurrentExpiryRule(parsedPreference);
        }
      } catch (error) {
        // DEBUG_CHAT && console.error('[FriendChat] Error loading privacy preference:', error);
      } finally {
        setPrivacyPreferenceLoaded(true);
      }
    };
    
    loadPrivacyPreference();
  }, []);

  // Add app state listener to handle status persistence across backgrounding
  useEffect(() => {
    let appStateSubscription: any;

    const handleAppStateChange = (nextAppState: any) => {
      console.log('READ_RECEIPTS', '📱 App state changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        console.log('READ_RECEIPTS', '🔄 App became active - refreshing message statuses');
        // When app becomes active, refresh the current conversation to get latest statuses
        if (user && friendId && privacyPreferenceLoaded) {
          // Reload messages to get the latest read statuses
          loadMessages(false).catch(error => {
            console.error('[DEBUG] ❌ Error reloading messages on app active:', error);
          });
        }
      }
    };

    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
    };
  }, [user, friendId, privacyPreferenceLoaded]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    if (user && friendId && privacyPreferenceLoaded) {
      initializeChat().then((cleanupFn) => {
        cleanup = cleanupFn;
      });
    }
    
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [user, friendId, privacyPreferenceLoaded]);

  // Mark messages as read whenever the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (!user || !friendId) return;
      
      const markCurrentMessagesAsRead = async () => {
        try {
          // // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 📖 Screen focused - checking for unread messages to mark as read');
          // // DEBUG_READ_RECEIPTS && console.log('[DEBUG] Current messages count:', messages.length);
          
          // Find unread messages from the friend
          const unreadMessages = messages.filter(msg => 
            !msg.isMine && // Message from friend
            msg.status !== 'read' && // Not already marked as read
            !msg.hasBeenViewed // Not already viewed
          );
          
          // Only log if there are unread messages
          if (unreadMessages.length === 0) {
            // // DEBUG_READ_RECEIPTS && console.log('[DEBUG] No unread messages found');
            return;
          }
          
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] Found', unreadMessages.length, 'unread messages to mark as read');
          const messageIds = unreadMessages.map(msg => msg.id);
          // // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🎯 Focus Effect: Using basic read receipts system for message IDs:', messageIds);
          
          // Use basic read receipts system
          for (const messageId of messageIds) {
            try {
              await markMessageAsRead(messageId);
              // DEBUG_READ_RECEIPTS && console.log('[DEBUG] ✅ Focus Effect: Successfully marked message as read:', messageId);
              
              // Update local state to reflect the read status
              setMessages(prev => prev.map(msg => 
                msg.id === messageId 
                  ? { ...msg, status: 'read' as const, hasBeenViewed: true }
                  : msg
              ));
            } catch (error) {
              console.error('[DEBUG] ❌ Focus Effect: Exception marking message as read:', messageId, error);
            }
          }
          
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] ✅ Focus Effect: Completed processing all unread messages with basic system');
        } catch (error) {
          console.error('[DEBUG] ❌ Error in markCurrentMessagesAsRead:', error);
        }
      };
      
      // Mark messages as read when screen is focused
      markCurrentMessagesAsRead();
      
      // No polling needed - real-time subscriptions will handle updates automatically
      
      return () => {
        // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🛑 Read receipts focus effect cleanup');
        
        // Handle chat exit clearing for view-once messages
        if (user?.id && friendId) {
          console.log(`[ViewOnceClearing] 🚪 User leaving chat with ${friendId} - checking for view-once messages to clear`);
          
          ViewOnceMessageManager.handleChatExit(friendId, user.id)
            .then(clearedIds => {
              if (clearedIds.length > 0) {
                console.log(`[ViewOnceClearing] ✅ Cleared ${clearedIds.length} view-once messages on chat exit`);
              }
            })
            .catch(error => {
              console.error('[ViewOnceClearing] ❌ Error clearing messages on chat exit:', error);
            });
        }
      };
    }, [user, friendId, messages])
  );

  useEffect(() => {
    // Cleanup audio on unmount
    return () => {
      if (sound) {
        sound.unloadAsync().catch(err => console.log('Error unloading sound:', err));
      }
    };
  }, [sound]);

  // Function to save privacy preference to AsyncStorage
  const savePrivacyPreference = async (rule: ExpiryRule) => {
    try {
      const ruleString = JSON.stringify(rule);
      await AsyncStorage.setItem(PRIVACY_PREFERENCE_KEY, ruleString);
      
      // Verify the save by reading it back
      // Verify storage
      await AsyncStorage.getItem(PRIVACY_PREFERENCE_KEY);
    } catch (error) {
      // DEBUG_CHAT && console.error('[FriendChat] Error saving privacy preference:', error);
    }
  };

  // Enhanced function to update privacy rule and persist it
  const updatePrivacyRule = async (rule: ExpiryRule) => {
    setCurrentExpiryRule(rule);
    await savePrivacyPreference(rule);
  };

  const initializeChat = async () => {
    try {
      
      if (!user) {
        throw new Error('No user available');
      }

      // No need to initialize encryption anymore - shared secret works immediately

      // Load existing messages
      await loadMessages();
      
      // Subscribe to new messages
      const unsubscribe = subscribeToMessages();
      
      // SHELVED: Screenshot prevention feature
      // Subscribe to screenshot notifications
      // const unsubscribeScreenshots = subscribeToScreenshotNotifications();
      
      // Start adaptive polling for new messages as fallback
      // Use shorter interval for first minute, then longer interval for inactive chats
      let pollCount = 0;
      const adaptivePolling = () => {
        checkForNewMessages();
        pollCount++;
        
        // After 20 polls (1 minute), slow down polling if no activity
        if (pollCount > 20) {
          clearInterval(messagePollingInterval.current!);
          messagePollingInterval.current = setInterval(checkForNewMessages, 5000); // 5 second polls
          console.log('[Polling Optimization] Switched to 5-second polling interval for inactive chat');
        }
      };
      
      messagePollingInterval.current = setInterval(adaptivePolling, 3000);
      
      // Subscribe to message clearing events
      const unsubscribeClearing = messageClearingService.subscribeToMessageClearing(() => {
        // DEBUG_CHAT && console.log('[FriendChat] Received message clearing event, clearing local messages');
        setMessages([]);
        setMessageOffset(0);
        setHasMoreMessages(true);
        lastMessageCount.current = 0;
      });
      
      // REGISTER WITH VIEW-ONCE UI MANAGER for immediate local clearing
      const chatId = `${user.id}-${friendId}`;
      console.log(`[FriendChatScreen] 📱 Registering with ViewOnceUIManager for chat: ${chatId}`);
      
      // Register direct callback for immediate UI updates
      ViewOnceUIManager.registerChatScreen(chatId, handleViewOnceMessageCleared);
      
      // Subscribe to view-once clearing events (fallback/broadcast)
      const unsubscribeViewOnceClearing = ViewOnceUIManager.subscribe((event) => {
        console.log(`[FriendChatScreen] 📡 Received view-once clearing event:`, event);
        handleViewOnceMessageCleared(event.messageId);
      });
      
      setLoading(false);
      
      return () => {
        unsubscribe();
        // SHELVED: Screenshot prevention feature
        // unsubscribeScreenshots();
        unsubscribeClearing();
        
        // Cleanup ViewOnceUIManager registration
        console.log(`[FriendChatScreen] 🧹 Cleaning up ViewOnceUIManager registration for chat: ${chatId}`);
        ViewOnceUIManager.unregisterChatScreen(chatId);
        unsubscribeViewOnceClearing();
        
        clearAllStatusTimers(); // Clear all pending status update timers
        if (messagePollingInterval.current) {
          clearInterval(messagePollingInterval.current);
        }
      };
    } catch (error) {
      console.error('Error initializing chat:', error instanceof Error ? error.message : String(error));
      console.error('Full error details:', JSON.stringify(error, null, 2));
      Alert.alert('Error', 'Failed to initialize chat');
    }
  };

  const loadMessages = async (loadMore = false) => {
    // Declare convertedMessages outside try block to ensure it's always defined
    let convertedMessages: Message[] = [];
    
    try {
      if (loadMore && loadingMore) return;
      
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      const currentOffset = loadMore ? messageOffset : 0;
      
      
      // Load messages from the database with pagination
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1);

      if (error) {
        // DEBUG_CHAT && console.error('[FriendChat] Error loading messages:', error);
        return;
      }

      
      // Check if we have more messages
      if (data && data.length < PAGE_SIZE) {
        setHasMoreMessages(false);
      }
      
      // Reverse the messages to show oldest first
      const reversedData = data ? [...data].reverse() : [];

      // Filter expired messages using utility function
      const filteredMessages = filterExpiredMessages(reversedData || []);

      // Mark all messages from friend as read
      if (reversedData && reversedData.length > 0) {
        const unreadMessageIds = reversedData
          .filter(msg => msg.sender_id === friendId && !msg.read_at)
          .map(msg => msg.id);

        if (unreadMessageIds.length > 0) {
          // DEBUG_CHAT && console.log('[FriendChat] 🚀 Using basic read receipts system - marking', unreadMessageIds.length, 'messages as read');
          
          // Use basic read receipts system for each message
          for (const messageId of unreadMessageIds) {
            try {
              await markMessageAsRead(messageId);
              // DEBUG_CHAT && console.log('[FriendChat] ✅ Successfully marked message as read:', messageId);
              
              // Handle ephemeral messages
              await EphemeralMessageService.markMessageViewed(messageId);
            } catch (error) {
              // DEBUG_CHAT && console.error('[FriendChat] ❌ Exception marking message as read:', messageId, error);
            }
          }
        }
      }

      // Convert to our message format and decrypt if needed
      // Add safety check in case filteredMessages is somehow null/undefined
      const messagesToConvert = filteredMessages || [];
      for (const msg of messagesToConvert) {
        
        let content = '';
        
        if (msg.type === 'text') {
          // Check if message is encrypted
          if (msg.is_encrypted && msg.nonce) {
            try {
              
              // Decrypt the message
              // For decryption, we need to use the sender's ID and our ID in the right order
              const senderId = msg.sender_id;
              const recipientId = msg.recipient_id;
              
              
              const decrypted = await FriendEncryption.decryptMessage(
                msg.content,
                msg.nonce,
                msg.ephemeral_public_key || '',
                senderId === user?.id ? recipientId : senderId, // friendId
                user?.id || ''
              );
              
              content = decrypted || msg.content; // Fallback to encrypted content if decryption fails
            } catch (error) {
              // DEBUG_CHAT && console.error('[FriendChat] Failed to decrypt message:', error);
              content = '[Failed to decrypt]';
            }
          } else {
            // Plain text message (legacy)
            content = msg.content;
          }
        } else if (msg.type === 'voice' || msg.type === 'video') {
          // Voice/Video message - media path
          content = msg.media_path || '';
        } else {
          // Unknown type
          content = '';
        }
        
        const messageStatus = computeMessageStatus(msg, user?.id || '');
        convertedMessages.push({
          id: msg.id,
          type: msg.type || 'voice',
          content,
          isMine: msg.sender_id === user?.id,
          timestamp: new Date(msg.created_at),
          status: messageStatus,
          duration: msg.duration,
          expiryRule: msg.expiry_rule,
          isEphemeral: msg.expiry_rule && msg.expiry_rule.type !== 'none',
          hasBeenViewed: msg.sender_id === user?.id && msg.viewed_at !== null,
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id
        });
        
        // Schedule status update for sent messages that should be delivered
        if (messageStatus === 'sent' && msg.sender_id === user?.id) {
          // Check if message is old enough to be delivered immediately
          const messageAge = Date.now() - new Date(msg.created_at).getTime();
          if (messageAge > 2000) {
            // Update to delivered immediately
            convertedMessages[convertedMessages.length - 1].status = 'delivered';
          } else {
            // Schedule update for remaining time
            const remainingTime = 2000 - messageAge;
            setTimeout(() => {
              scheduleStatusUpdate(msg.id, 'sent', 'delivered');
            }, Math.max(0, remainingTime));
          }
        }
      }

      if (loadMore) {
        // Prepend older messages
        setMessages(prev => [...convertedMessages, ...prev]);
        setMessageOffset(messageOffset + (data?.length || 0));
      } else {
        // Initial load
        setMessages(convertedMessages);
        setMessageOffset(data?.length || 0);
      }
      
      // Safely update the last message count
      lastMessageCount.current = convertedMessages.length;
    } catch (error) {
      // DEBUG_CHAT && console.error('[FriendChat] Error in loadMessages:', error);
      // DEBUG_CHAT && console.error('[FriendChat] Error stack:', error.stack);
      // DEBUG_CHAT && console.error('[FriendChat] convertedMessages at error:', convertedMessages);
      // Ensure lastMessageCount is set even on error
      lastMessageCount.current = convertedMessages.length;
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Schedule status updates for sent messages to become delivered after 2 seconds
  const scheduleStatusUpdate = (messageId: string, fromStatus: 'sent', toStatus: 'delivered') => {
    // Clear any existing timer for this message
    if (statusUpdateTimers.current[messageId]) {
      clearTimeout(statusUpdateTimers.current[messageId]);
    }
    
    // Schedule the status update
    statusUpdateTimers.current[messageId] = setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId && msg.status === fromStatus 
          ? { ...msg, status: toStatus }
          : msg
      ));
      
      // Clean up the timer reference
      delete statusUpdateTimers.current[messageId];
    }, 2000); // 2 seconds delay for delivery
  };

  // Clean up all status update timers
  const clearAllStatusTimers = () => {
    Object.values(statusUpdateTimers.current).forEach(timer => clearTimeout(timer));
    statusUpdateTimers.current = {};
  };

  const checkForNewMessages = async () => {
    if (!user) return;
    
    try {
      // Check for ALL messages to get updated read statuses (not just new ones)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        // DEBUG_CHAT && console.error('[FriendChat] Error checking for new messages:', error);
        return;
      }

      // Filter expired messages using utility function
      const nonExpiredMessages = filterExpiredMessages(data || []);
      
      const currentCount = nonExpiredMessages.length;
      
      // PERFORMANCE FIX: Only process messages if there are actual changes
      // Check for changes in message count OR message modifications
      const hasChanges = hasMessageChanges(nonExpiredMessages, messages, user?.id || '');
      
      if (hasChanges || currentCount !== lastMessageCount.current) {
        
        // Convert and decrypt messages
        const convertedMessages: Message[] = [];
        
        for (const msg of nonExpiredMessages) {
          let content = '';
          
          if (msg.type === 'text') {
            if (msg.is_encrypted && msg.nonce) {
              try {
                const decrypted = await FriendEncryption.decryptMessage(
                  msg.content,
                  msg.nonce,
                  msg.ephemeral_public_key,
                  friendId,
                  user?.id || ''
                );
                content = decrypted || '[Failed to decrypt]';
              } catch (error) {
                // DEBUG_CHAT && console.error('[FriendChat] Failed to decrypt message:', error);
                content = '[Failed to decrypt]';
              }
            } else {
              content = msg.content;
            }
          } else if (msg.type === 'voice' || msg.type === 'video') {
            content = msg.media_path || '';
          } else {
            content = '';
          }
          
          convertedMessages.push({
            id: msg.id,
            type: msg.type || 'voice',
            content,
            isMine: msg.sender_id === user?.id,
            timestamp: new Date(msg.created_at),
            status: (() => {
              const computedStatus = computeMessageStatus(msg, user?.id || '');
              // Only log status changes for messages we sent
              if (msg.sender_id === user?.id && computedStatus === 'read') {
                // DEBUG_READ_RECEIPTS && console.log(`[DEBUG] ✅ Message ${msg.id} marked as READ by recipient`);
              }
              return computedStatus;
            })(),
            duration: msg.duration,
            expiryRule: msg.expiry_rule,
            isEphemeral: msg.expiry_rule && msg.expiry_rule.type !== 'none',
            hasBeenViewed: msg.sender_id === user?.id && msg.viewed_at !== null
          });
        }

        // Update messages with new read statuses from database
        // IMPORTANT: Use the NEW status from database, not the old one!
        // PERFORMANCE: Only update if messages actually changed to prevent unnecessary re-renders
        if (!areMessageArraysEquivalent(convertedMessages, messages)) {
          console.log(`[Polling Optimization] Messages changed - updating UI (${messages.length} → ${convertedMessages.length} messages)`);
          setMessages(convertedMessages);
        } else {
          console.log(`[Polling Optimization] No message changes detected - skipping UI update`);
        }
        lastMessageCount.current = currentCount;
        
        // Only scroll if there are actually new messages (not just status updates)
        if (currentCount > messages.length) {
          flatListRef.current?.scrollToEnd();
        }
      }
    } catch (error) {
      // DEBUG_CHAT && console.error('[FriendChat] Error in checkForNewMessages:', error);
    }
  };

  // SHELVED: Screenshot prevention feature
  // Subscribe to screenshot notifications for messages I own
  const subscribeToScreenshotNotifications = () => { return () => {}; }; /*
    if (!user?.id) return () => {};
    
    // Subscribe to screenshot attempts where this user is the message owner
    const screenshotSubscription = supabase
      .channel(`screenshot-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'screenshot_attempts',
          // Listen for screenshots of messages I sent to this friend or received from this friend
        },
        async (payload) => {
          try {
            const screenshotAttempt = payload.new;
            const messageId = screenshotAttempt.message_id;
            
            // Only show notification if:
            // 1. It's a message in this chat
            // 2. I'm the message owner (not the one taking screenshot)
            if (messageId) {
              // Get the message details to check ownership
              const { data: messageData, error } = await supabase
                .from('messages')
                .select('sender_id, recipient_id, type')
                .eq('id', messageId)
                .single();
                
              if (!error && messageData) {
                const isMyMessage = messageData.sender_id === user.id;
                const isThisChat = (messageData.sender_id === user.id && messageData.recipient_id === friendId) ||
                                 (messageData.sender_id === friendId && messageData.recipient_id === user.id);
                
                // Show notification only if it's my message in this chat and I didn't take the screenshot
                if (isMyMessage && isThisChat && screenshotAttempt.user_id !== user.id) {
                  try {
                    // Show local notification (less intrusive than Alert)
                    await Notifications.scheduleNotificationAsync({
                      content: {
                        title: '📸 Screenshot Detected',
                        body: 'Someone took a screenshot of your message',
                        data: {
                          type: 'screenshot_detected',
                          messageId: messageId,
                        },
                      },
                      trigger: null, // Show immediately
                    });
                    
                    // screenshotLog // SHELVED: Screenshot prevention feature('In-app notification shown for message:', messageId);
                  } catch (notifError) {
                    // Fallback to Alert if notification fails
                    // screenshotWarn // SHELVED: Screenshot prevention feature('Local notification failed, using Alert:', notifError);
                    Alert.alert(
                      '📸 Screenshot Detected',
                      'Someone took a screenshot of your message',
                      [{ text: 'OK', style: 'default' }],
                      { cancelable: true }
                    );
                  }
                }
              }
            }
          } catch (error) {
            console.error('[Screenshot] Error processing screenshot notification:', error);
          }
        }
      )
      .subscribe();

    return () => {
      screenshotSubscription.unsubscribe();
    };
  }; */

  const subscribeToMessages = () => {
    
    // Create a consistent channel name regardless of who is user/friend
    const channelName = [user?.id, friendId].sort().join('-');
    
    // Subscribe to new messages between this user and friend
    const subscription = supabase
      .channel(`friend-chat:${channelName}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${user?.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${user?.id}))`
        },
        async (payload) => {
          
          if (payload.new.sender_id !== user?.id) {
            // Message from friend - decrypt if needed
            let content = '';
            
            if (payload.new.type === 'text') {
              if (payload.new.is_encrypted && payload.new.nonce) {
                try {
                  const decrypted = await FriendEncryption.decryptMessage(
                    payload.new.content,
                    payload.new.nonce,
                    payload.new.ephemeral_public_key,
                    friendId,
                    user?.id || ''
                  );
                  content = decrypted || '[Failed to decrypt]';
                } catch (error) {
                  // DEBUG_CHAT && console.error('[FriendChat] Failed to decrypt real-time message:', error);
                  content = '[Failed to decrypt]';
                }
              } else {
                content = payload.new.content;
              }
            } else if (payload.new.type === 'voice' || payload.new.type === 'video') {
              content = payload.new.media_path || '';
            } else {
              content = '';
            }
            
            const newMessage: Message = {
              id: payload.new.id,
              type: payload.new.type || 'voice',
              content,
              isMine: false,
              timestamp: new Date(payload.new.created_at),
              status: computeMessageStatus(payload.new, user?.id || ''),
              duration: payload.new.duration,
              expiryRule: payload.new.expiry_rule,
              isEphemeral: payload.new.expiry_rule && payload.new.expiry_rule.type !== 'none',
              hasBeenViewed: false // New messages from others haven't been viewed yet
            };
            
            setMessages(prev => [...prev, newMessage]);
            flatListRef.current?.scrollToEnd();
          }
        }
      )
      .subscribe((status) => {
        // NEW MESSAGE subscription status: status
      });

    // Also subscribe to message expiry for ephemeral messages
    const expirySubscription = EphemeralMessageService.subscribeToMessageExpiry((expiredMessageId) => {
      setMessages(prev => prev.filter(msg => msg.id !== expiredMessageId));
    });

    // FALLBACK: Start polling for ephemeral message expiry (since real-time is unreliable)
    const stopExpiryPolling = EphemeralMessageService.startExpiryPolling(
      user?.id || '',
      (expiredMessageIds) => {
        if (expiredMessageIds.length > 0) {
          console.log(`[FriendChat] Polling found ${expiredMessageIds.length} expired messages, removing from UI`);
          setMessages(prev => prev.filter(msg => !expiredMessageIds.includes(msg.id)));
        }
      },
      3000 // Poll every 3 seconds when chat is active
    );

    // Subscribe to view-once message clearing notifications
    const clearingSubscription = ViewOnceMessageManager.subscribeToMessageClearing(
      user?.id || '',
      (messageId, clearingInfo) => {
        console.log(`[ViewOnceClearing] 📨 Received clearing notification for message: ${messageId}`);
        
        // Remove message from sender's UI if it was cleared
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        
        console.log(`[ViewOnceClearing] ✅ Removed cleared view-once message from UI: ${messageId}`);
      }
    );

    // FALLBACK: Start polling for view-once message clearing (since real-time is unreliable)
    const stopClearingPolling = MessageStatusService.startStatusPolling(
      user?.id || '',
      (clearedMessageIds) => {
        if (clearedMessageIds.length > 0) {
          console.log(`[ViewOnceClearing] 📊 Polling found ${clearedMessageIds.length} newly cleared messages`);
          setMessages(prev => prev.filter(msg => !clearedMessageIds.includes(msg.id)));
        }
      },
      3000 // Poll every 3 seconds when chat is active
    );

    // Subscribe to message updates to detect when messages are marked as expired or read
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔧 Setting up real-time subscription for channel:', `message-updates:${channelName}`);
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔧 User ID:', user?.id, 'Friend ID:', friendId);
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔧 Channel name:', channelName);
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔧 Timestamp for unique channel:', Date.now());
    
    // CRITICAL DIAGNOSTIC: Check if we have necessary permissions for real-time
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔧 DIAGNOSTIC - Supabase client config:');
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - URL:', supabase.supabaseUrl);
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - Auth user:', user?.id ? 'Present' : 'Missing');
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - Realtime enabled:', supabase.realtime ? 'Yes' : 'No');
    
    // FIXED: Try multiple subscription approaches to ensure real-time updates work
    // Approach 1: Global subscription with handler filtering
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔧 Attempting global message UPDATE subscription...');
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔧 Subscription will listen for ALL message UPDATEs and filter in handler');
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔧 Filter criteria: sender_id =', user?.id, 'OR recipient_id =', user?.id);
    const messageUpdateSubscription = supabase
      .channel(`message-updates:${channelName}:${Date.now()}`) // Unique channel name
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
          // No filter - handle all message updates and filter in handler
        },
        async (payload) => {
          // CRITICAL: Log this IMMEDIATELY so we can see if handler is being called
          // DISABLED FOR DEBUG: console.log('======================== REAL-TIME UPDATE ========================');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🚨 REAL-TIME UPDATE RECEIVED AT:', new Date().toISOString());
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🚨 UPDATE HANDLER CALLED - This proves subscription is working!');
          // DISABLED FOR DEBUG: console.log('================================================================');
          
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🚨 Raw payload:', JSON.stringify(payload, null, 2));
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🚨 Event type:', payload.eventType);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🚨 Message ID:', payload.new?.id);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🚨 Sender ID in payload:', payload.new?.sender_id);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🚨 Recipient ID in payload:', payload.new?.recipient_id);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🚨 Current user ID:', user?.id);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🚨 Current friend ID:', friendId);
          
          // Additional diagnostic info
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧪 SUBSCRIPTION DIAGNOSTIC:');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - Handler function is executing');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - Payload exists:', !!payload);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - Payload.new exists:', !!payload?.new);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - User context exists:', !!user?.id);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - Friend context exists:', !!friendId);
          
          // Filter messages to only this conversation
          const isOurConversation = 
            (payload.new.sender_id === user?.id && payload.new.recipient_id === friendId) ||
            (payload.new.sender_id === friendId && payload.new.recipient_id === user?.id);
          
          if (!isOurConversation) {
            // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🚫 UPDATE not for our conversation, ignoring');
            return;
          }
          
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] ✅ UPDATE is for our conversation!');
          // DEBUG_CHAT && console.log('[FriendChat] Message updated:', payload);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔄 UPDATE subscription triggered at', new Date().toLocaleTimeString());
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] Old read_at:', payload.old?.read_at);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] New read_at:', payload.new?.read_at);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] Message sender:', payload.new?.sender_id, 'Current user:', user?.id);
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] Full payload old:', JSON.stringify(payload.old, null, 2));
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] Full payload new:', JSON.stringify(payload.new, null, 2));
          
          // Check if the message is now expired or viewed (for view-once)
          if (payload.new.expired || 
              (payload.new.expiry_rule?.type === 'view' && payload.new.viewed_at)) {
            // DEBUG_CHAT && console.log('[FriendChat] Message marked as expired/viewed, removing:', payload.new.id);
            setMessages(prev => prev.filter(msg => msg.id !== payload.new.id));
          }
          
          // For sender: Update message status when recipient views/reads it
          const wasRead = payload.new.read_at && !payload.old.read_at;
          const wasViewed = payload.new.viewed_at && !payload.old.viewed_at;
          const wasListened = payload.new.listened_at && !payload.old.listened_at;
          
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔍 DETAILED TIMESTAMP ANALYSIS:');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - old.read_at:', payload.old?.read_at || 'null');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - new.read_at:', payload.new?.read_at || 'null');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - old.viewed_at:', payload.old?.viewed_at || 'null');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - new.viewed_at:', payload.new?.viewed_at || 'null');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - old.listened_at:', payload.old?.listened_at || 'null');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - new.listened_at:', payload.new?.listened_at || 'null');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] Status change flags - wasRead:', wasRead, 'wasViewed:', wasViewed, 'wasListened:', wasListened);
          
          if (payload.new.sender_id === user?.id && (wasRead || wasViewed || wasListened)) {
            // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🎯 RECIPIENT INTERACTION DETECTED!');
            // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 📤 Message sent by us, recipient interacted:', payload.new.id);
            // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔍 Interaction details:', { wasRead, wasViewed, wasListened });
            // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧮 Computing new status based on updated message...');
            
            // CRITICAL FIX: Ensure the message object passed to computeMessageStatus 
            // has the correct structure and updated timestamp fields
            const messageForStatusComputation = {
              ...payload.new,
              // Ensure we have the latest timestamp values
              read_at: payload.new.read_at,
              viewed_at: payload.new.viewed_at, 
              listened_at: payload.new.listened_at
            };
            
            // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔍 Message data being used for status computation:', {
            //   id: messageForStatusComputation.id,
            //   type: messageForStatusComputation.type,
            //   sender_id: messageForStatusComputation.sender_id,
            //   read_at: messageForStatusComputation.read_at,
            //   viewed_at: messageForStatusComputation.viewed_at,
            //   listened_at: messageForStatusComputation.listened_at
            // });
            
            const newStatus = computeMessageStatus(messageForStatusComputation, user?.id || '');
            // DEBUG_READ_RECEIPTS && console.log('[DEBUG] ✅ New computed status:', newStatus);
            setMessages(prev => {
              const updated = prev.map(msg => 
                msg.id === payload.new.id 
                  ? { 
                      ...msg, 
                      status: newStatus, 
                      hasBeenViewed: true,
                      read_at: payload.new.read_at,
                      viewed_at: payload.new.viewed_at,
                      listened_at: payload.new.listened_at
                    }
                  : msg
              );
              // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔄 Updated local message state:');
              const updatedMessage = updated.find(m => m.id === payload.new.id);
              // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 📋 Message after update:', {
              //   id: updatedMessage?.id,
              //   status: updatedMessage?.status,
              //   read_at: updatedMessage?.read_at || 'null',
              //   viewed_at: updatedMessage?.viewed_at || 'null',
              //   listened_at: updatedMessage?.listened_at || 'null'
              // });
              return updated;
            });
            
            // For view-once and playback messages, schedule fade out after a delay
            if (payload.new.expiry_rule?.type === 'view' || payload.new.expiry_rule?.type === 'playback') {
              const fadeDelay = payload.new.expiry_rule?.type === 'playback' ? 
                (payload.new.duration ? (payload.new.duration * 1000) + 2000 : 5000) : // Audio duration + 2s buffer
                3000; // Standard view-once delay
              
              setTimeout(() => {
                setMessages(prev => prev.filter(msg => msg.id !== payload.new.id));
              }, fadeDelay);
            }
          }
        }
      )
      .subscribe((status) => {
        // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 📡 MESSAGE UPDATE subscription status:', status);
        if (status === 'SUBSCRIBED') {
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] ✅ Successfully subscribed to message updates - realtime should now work');
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧪 Testing subscription: updating a test field...');
          
          // Test the subscription by attempting a dummy update (optional test)
          // This helps verify the subscription is actually working
          if (user?.id && friendId) {
            // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧪 Subscription test: Channel active, ready for UPDATE events');
            
            // DIAGNOSTIC TEST: Try to trigger a test update to verify subscription
            setTimeout(async () => {
              // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧪 RUNNING SUBSCRIPTION TEST...');
              try {
                // Find a recent message we sent to test with
                const testMessage = messages.find(msg => msg.isMine && msg.type === 'text');
                if (testMessage) {
                  // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧪 Testing with message:', testMessage.id);
                  
                  // Try a harmless update to test the subscription
                  const { error } = await supabase
                    .from('messages')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('id', testMessage.id);
                  
                  if (error) {
                    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧪 Test update failed (expected):', error.message);
                  } else {
                    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧪 Test update succeeded - should trigger UPDATE event');
                  }
                } else {
                  // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧪 No messages available for testing');
                }
              } catch (error) {
                // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧪 Test error (expected):', error);
              }
            }, 3000); // Test after 3 seconds
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[DEBUG] ❌ CRITICAL: Error subscribing to message updates');
          console.error('[DEBUG] 💡 This likely means:');
          console.error('[DEBUG]   - Database permissions issue');
          console.error('[DEBUG]   - Row-level security blocking subscription');
          console.error('[DEBUG]   - Invalid channel configuration');
          
          // BACKUP MECHANISM: If real-time fails, set up polling as fallback
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔄 Setting up polling fallback for read receipts...');
          // DISABLED FOR DEBUG: const pollInterval = setInterval(async () => {
          //   // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 📊 Polling for message status updates...');
          //   try {
          //     await loadMessages(false);
          //   } catch (error) {
          //     console.error('[DEBUG] ❌ Polling error:', error);
          //   }
          // }, 5000); // Poll every 5 seconds
          
          // Store interval for cleanup
          // (messageUpdateSubscription as any).pollInterval = pollInterval;
          
        } else if (status === 'CLOSED') {
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔴 Message update subscription closed');
        } else {
          // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 📡 Subscription status change:', status);
        }
      });
      
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🎯 Real-time setup complete. Subscriptions:');
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - New messages: subscription');
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - Message expiry: expirySubscription');  
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG]   - Message updates: messageUpdateSubscription');
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔍 Ready to receive UPDATE events when messages are marked as read');
    // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🔍 Test by marking a message as read on the other device...');

    return () => {
      // DEBUG_READ_RECEIPTS && console.log('[DEBUG] 🧹 Cleaning up subscriptions and intervals...');
      subscription.unsubscribe();
      expirySubscription.unsubscribe();
      messageUpdateSubscription.unsubscribe();
      clearingSubscription.unsubscribe(); // Clean up view-once clearing subscription
      stopExpiryPolling(); // Clean up ephemeral message polling
      stopClearingPolling(); // Clean up view-once clearing polling
      
      // SHELVED: Screenshot prevention feature - pollInterval commented out
      // Clean up polling interval if it exists
      // if ((messageUpdateSubscription as any).pollInterval) {
      //   clearInterval((messageUpdateSubscription as any).pollInterval);
      //   // DEBUG_READ_RECEIPTS && console.log('[DEBUG] ✅ Polling interval cleaned up');
      // }
    };
  };

  const sendTextMessage = async () => {
    if (!inputText.trim() || !user) return;

    try {
      const messageText = inputText.trim();
      setInputText('');

      // Add optimistic message
      const tempMessage: Message = {
        id: Date.now().toString(),
        type: 'text',
        content: messageText,
        isMine: true,
        timestamp: new Date(),
        status: 'sending',
        expiryRule: currentExpiryRule
      };
      
      setMessages(prev => [...prev, tempMessage]);
      flatListRef.current?.scrollToEnd();

      // Encrypt the message
      const encrypted = await FriendEncryption.encryptMessage(
        messageText,
        friendId,
        user.id
      );

      if (!encrypted) {
        throw new Error('Failed to encrypt message');
      }

      // PHASE 2 FIX: Include recipient key metadata for text messages (consistent with voice/video)
      console.log('[FriendChat] PHASE 2: Using recipient key metadata for text message...');
      console.log('- Recipient Key ID:', encrypted.recipientKeyId);
      console.log('- Recipient Device ID:', encrypted.recipientDeviceId);
      console.log('[FriendChat] ✅ Using PHASE 2 recipient key tracking for nacl.box.open null fix');
      
      // Send to database
      const { data: sentMessage, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: friendId,
          type: 'text',
          content: encrypted.encryptedContent,
          is_encrypted: true,
          nonce: encrypted.nonce,
          ephemeral_public_key: encrypted.ephemeralPublicKey,
          // PHASE 1 FIX: Include recipient metadata to track exact keys used (consistent with voice/video)
          recipient_key_id: encrypted.recipientKeyId,
          recipient_device_id: encrypted.recipientDeviceId,
          expiry_rule: currentExpiryRule
        })
        .select()
        .single();

      if (!error && sentMessage) {
        // Send push notification to recipient
        try {
          // Get current user's username
          const { data: userData } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .single();
          
          await sendMessageNotification(
            friendId,
            user.id,
            userData?.username || 'Someone',
            'text'
          );
        } catch (pushError) {
          // Don't fail the message send if push fails
        }
      }

      if (error) {
        // DEBUG_CHAT && console.error('[FriendChat] Error sending message:', error);
        
        // Update message status to failed
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempMessage.id 
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
        
        Alert.alert('Error', 'Failed to send message');
        return;
      }

      // Update message with real ID and computed status
      const newStatus = computeMessageStatus(sentMessage, user?.id || '');
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMessage.id 
            ? { 
                ...msg, 
                id: sentMessage.id,
                status: newStatus
              }
            : msg
        )
      );
      
      // Schedule status update from 'sent' to 'delivered' after 2 seconds
      if (newStatus === 'sent') {
        scheduleStatusUpdate(sentMessage.id, 'sent', 'delivered');
      }
      
      // Privacy preference is now persisted - no reset needed

    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const startRecording = async () => {
    try {
      // ANDROID UI FIX: Set recording state immediately for instant UI feedback
      console.log('[Voice Recording] Starting recording - setting UI state immediately...');
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingDuration(0);
      
      // Reset swipe position
      swipeX.setValue(0);
      setShouldCancel(false);
      
      // Start UI animations immediately
      Animated.parallel([
        Animated.spring(micScale, {
          toValue: 1.5,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(micPulse, {
              toValue: 1.1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(micPulse, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();
      
      // Start duration timer immediately
      recordingInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      console.log('[Voice Recording] UI state set, now requesting permissions...');
      
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        // Reset UI state on permission failure
        await cancelRecording();
        Alert.alert('Permission needed', 'Please grant microphone access');
        return;
      }

      console.log('[Voice Recording] Permissions granted, configuring audio...');

      // Configure audio for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      console.log('[Voice Recording] Audio configured, creating recording...');

      // Use a simpler, more compatible recording preset
      const recordingOptions = Audio.RecordingOptionsPresets.HIGH_QUALITY;

      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);

      console.log('[Voice Recording] ✅ Recording created successfully!');
      setRecording(newRecording);

      // Add glowing effect (animations already started above)
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordButtonGlow, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(recordButtonGlow, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      ).start();

      // Start animated waveform
      const startWaveformAnimation = () => {
        waveformAnimations.forEach((anim, index) => {
          Animated.loop(
            Animated.sequence([
              Animated.timing(anim, {
                toValue: Math.random() * 0.8 + 0.2,
                duration: 150 + (index * 50), // Staggered timing
                useNativeDriver: false,
              }),
              Animated.timing(anim, {
                toValue: Math.random() * 0.8 + 0.2,
                duration: 150 + (index * 50),
                useNativeDriver: false,
              }),
            ])
          ).start();
        });
      };
      
      startWaveformAnimation();

    } catch (error) {
      console.error('Failed to start recording:', error);
      
      // Reset recording state on error
      setRecording(null);
      setIsRecording(false);
      isRecordingRef.current = false;
      setRecordingDuration(0);
      
      // Clear any intervals that might have started
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
      
      // Reset animations
      micScale.setValue(1);
      micPulse.setValue(1);
      recordButtonGlow.setValue(0);
      
      // Show specific error message based on error type
      let errorMessage = 'Failed to start recording. Please try again.';
      if (error?.message?.includes('permission')) {
        errorMessage = 'Microphone permission is required. Please enable it in your device settings.';
      } else if (error?.message?.includes('audio mode')) {
        errorMessage = 'Audio configuration failed. Please restart the app and try again.';
      } else if (error?.message?.includes('recording')) {
        errorMessage = 'Recording initialization failed. Please check if another app is using the microphone.';
      }
      
      Alert.alert('Recording Error', errorMessage);
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    
    
    // Clear interval
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }
    
    try {
      await recording.stopAndUnloadAsync();
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
    
    setRecording(null);
    setIsRecording(false);
    isRecordingRef.current = false;
    setRecordingDuration(0);
    setShouldCancel(false);
    
    // Reset animations
    Animated.parallel([
      Animated.spring(micScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(swipeX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    micPulse.stopAnimation();
    micPulse.setValue(1);
    recordButtonGlow.stopAnimation();
    recordButtonGlow.setValue(0);
    
    // Stop waveform animations
    waveformAnimations.forEach(anim => {
      anim.stopAnimation();
      anim.setValue(0.3);
    });
  };

  const stopRecording = async () => {
    if (!recording || !user) {
      return;
    }

    try {
      
      // Clear interval
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }

      // Check if user swiped to cancel
      if (shouldCancel) {
        await cancelRecording();
        return;
      }

      // Minimum recording duration check
      if (recordingDuration < 1) {
        await cancelRecording();
        return;
      }

      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      setIsRecording(false);
      isRecordingRef.current = false;
      setRecording(null);
      
      // Store duration before resetting
      const finalDuration = recordingDuration;
      setRecordingDuration(0);
      
      // Reset animations
      Animated.parallel([
        Animated.spring(micScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(swipeX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      
      micPulse.stopAnimation();
      micPulse.setValue(1);
      recordButtonGlow.stopAnimation();
      recordButtonGlow.setValue(0);
      
      // Stop waveform animations
      waveformAnimations.forEach(anim => {
        anim.stopAnimation();
        anim.setValue(0.3);
      });
      
      if (!uri) return;

      // Show sending state immediately
      const tempId = Date.now().toString();
      const sendingMessage: Message = {
        id: tempId,
        type: 'voice',
        content: '',
        isMine: true,
        timestamp: new Date(),
        status: 'sending',
        duration: finalDuration
      };
      
      setMessages(prev => [...prev, sendingMessage]);
      setUploadingMessageId(tempId);
      flatListRef.current?.scrollToEnd();

      // Upload the recording with E2E encryption
      const uploadResult = await uploadE2EEncryptedAudio(uri, user.id, friendId);
      
      if (uploadResult) {
        // Validate upload result has all required fields
        if (!uploadResult.path || !uploadResult.encryptedKey) {
          console.error('Invalid upload result - missing required fields:', uploadResult);
          Alert.alert('Error', 'Voice message encryption failed. Please try again.');
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          setUploadingMessageId(null);
          return;
        }
        
        // Remove the temporary message
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        setUploadingMessageId(null);
      
      // Privacy preference is now persisted - no reset needed
        
        // Send the actual message - create nonce JSON from separate fields with proper null handling
        const nonceJson = JSON.stringify({
          keyNonce: uploadResult.keyNonce || '',
          dataNonce: uploadResult.dataNonce || '',
          ephemeralPublicKey: uploadResult.ephemeralPublicKey || '',
          version: uploadResult.version || 3
        });
        
        console.log('[DEBUG] Voice message nonce data:', {
          keyNonce: !!uploadResult.keyNonce,
          dataNonce: !!uploadResult.dataNonce, 
          ephemeralPublicKey: !!uploadResult.ephemeralPublicKey,
          version: uploadResult.version
        });
        
        await handleVoiceSend(
          uploadResult.path,
          finalDuration,
          uploadResult.encryptedKey,
          nonceJson,
          finalDuration
        );
      } else {
        // Update to failed state
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
        setUploadingMessageId(null);
      
      // Privacy preference is now persisted - no reset needed
        Alert.alert('Error', 'Failed to upload voice message');
      }
    } catch (error) {
      console.error('Failed to stop recording', error);
      Alert.alert('Error', 'Failed to send voice message');
    }
  };

  const handleVoiceSend = async (audioPath: string, duration: number, encryptedKey: string, nonce: string, messageDuration?: number) => {
    if (!user) return;

    try {
      // Add optimistic message
      const tempId = Date.now().toString();
      const voiceMessage: Message = {
        id: tempId,
        type: 'voice',
        content: audioPath,
        isMine: true,
        timestamp: new Date(),
        status: 'sending',
        duration: messageDuration || duration,
        expiryRule: currentExpiryRule.type === 'view' ? { type: 'playback' } : currentExpiryRule
      };

      setMessages(prev => [...prev, voiceMessage]);
      setUploadingMessageId(tempId);
      flatListRef.current?.scrollToEnd();

      // Parse nonce to get encryption parameters with error handling
      let nonceData: any;
      try {
        nonceData = JSON.parse(nonce);
      } catch (parseError) {
        console.error('Failed to parse nonce JSON:', parseError);
        console.error('Nonce string was:', nonce);
        throw new Error('Invalid nonce data format');
      }
      const { version = 3, ephemeralPublicKey } = nonceData;
      
      // PHASE 1 FIX: Get recipient key metadata for tracking exact encryption parameters
      let recipientKeyId: string | null = null;
      let recipientDeviceId: string | null = null;
      
      try {
        console.log('[FriendChat] PHASE 1: Getting recipient key metadata for audio message...');
        const recipientKeys = await SecureDeviceKeys.getPublicKeysForUser(friendId);
        const currentKeys = recipientKeys.filter(k => k.is_current);
        
        if (currentKeys.length === 1) {
          recipientKeyId = currentKeys[0].id || null; // May not exist in older migrations
          recipientDeviceId = currentKeys[0].device_id;
          console.log('[FriendChat] ✅ Got recipient metadata:', { recipientKeyId, recipientDeviceId });
        } else {
          console.warn('[FriendChat] ⚠️ Could not get unique recipient key metadata');
          console.warn(`[FriendChat] Current keys: ${currentKeys.length}, Total keys: ${recipientKeys.length}`);
        }
      } catch (metadataError) {
        console.warn('[FriendChat] Could not get recipient metadata (Phase 1 migration may not be applied):', metadataError);
      }

      // Send to database - store zero-knowledge encrypted parameters
      const { data: sentMessage, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: friendId,
          type: 'voice',
          media_path: audioPath,
          content: encryptedKey, // Store encrypted key in content field
          nonce: nonce, // Store all nonces (keyNonce, dataNonce, etc.)
          ephemeral_public_key: ephemeralPublicKey, // Store ephemeral public key for zero-knowledge decryption
          encryption_version: version, // Store encryption version (3+ for zero-knowledge)
          // PHASE 1 FIX: Include recipient metadata to track exact keys used
          recipient_key_id: recipientKeyId,
          recipient_device_id: recipientDeviceId,
          is_encrypted: true,
          expiry_rule: currentExpiryRule.type === 'view' ? { type: 'playback' } : currentExpiryRule,
          duration: messageDuration || duration
        })
        .select()
        .single();

      if (error) {
        // DEBUG_CHAT && console.error('[FriendChat] Error sending voice message:', error);
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
        setUploadingMessageId(null);
      
      // Privacy preference is now persisted - no reset needed
        Alert.alert('Error', 'Failed to send voice message');
        return;
      }

      // Update message with real ID
      const newStatus = computeMessageStatus(sentMessage, user?.id || '');
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { 
                ...msg, 
                id: sentMessage.id,
                status: newStatus
              }
            : msg
        )
      );
      setUploadingMessageId(null);
      
      // Schedule status update from 'sent' to 'delivered' after 2 seconds
      if (newStatus === 'sent') {
        scheduleStatusUpdate(sentMessage.id, 'sent', 'delivered');
      }
      
      // Privacy preference is now persisted - no reset needed

      // Send push notification
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .single();
        
        await sendMessageNotification(
          friendId,
          user.id,
          userData?.username || 'Someone',
          'voice'
        );
      } catch (pushError) {
      }

      // Close the modal
      setShowRecordingModal(false);
    } catch (error) {
      console.error('Error sending voice message:', error);
      
      // Enhanced error logging for JSON parse issues
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        // Check if this is a JSON parse error
        if (error.message.includes('JSON Parse error') || error.message.includes('Unexpected character')) {
          console.error('JSON Parse Error - likely undefined values in nonce data');
          Alert.alert('Error', 'Voice message encryption failed. Please try again.');
        } else {
          Alert.alert('Error', 'Failed to send voice message');
        }
      } else {
        console.error('Non-Error object thrown:', error);
        Alert.alert('Error', 'Failed to send voice message');
      }
    }
  };

  const handleVideoSend = async (
    videoPath: string, 
    duration: number, 
    encryptedKey: string, 
    nonce: string, 
    dataNonce?: string,
    ephemeralPublicKey?: string,
    version: number = 3,
    recipientKeyId?: string,
    recipientDeviceId?: string
  ) => {
    if (!user) return;

    try {
      // Add optimistic message
      const tempId = Date.now().toString();
      const videoMessage: Message = {
        id: tempId,
        type: 'video',
        content: videoPath,
        isMine: true,
        timestamp: new Date(),
        status: 'sending',
        duration: duration,
        expiryRule: currentExpiryRule
      };

      setMessages(prev => [...prev, videoMessage]);
      setUploadingMessageId(tempId);
      flatListRef.current?.scrollToEnd();

      // PHASE 2 FIX: Use recipient key metadata passed from encryption process
      console.log('[FriendChat] PHASE 2: Using recipient key metadata from encryption process...');
      console.log('- Recipient Key ID:', recipientKeyId || 'not provided');
      console.log('- Recipient Device ID:', recipientDeviceId || 'not provided');
      
      if (recipientKeyId && recipientDeviceId) {
        console.log('[FriendChat] ✅ Using PHASE 2 recipient key tracking for nacl.box.open null fix');
      } else {
        console.warn('[FriendChat] ⚠️ No recipient key metadata provided - using legacy approach');
        console.warn('[FriendChat] This may result in nacl.box.open returning null for key mismatches');
      }

      // Send to database - store encrypted key and nonce for E2E encryption
      const { data: sentMessage, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: friendId,
          type: 'video',
          media_path: videoPath,
          content: encryptedKey, // Store encrypted key in content field
          nonce: nonce, // Key nonce for zero-knowledge key decryption
          data_nonce: dataNonce, // Data nonce for video content decryption
          ephemeral_public_key: ephemeralPublicKey, // Store ephemeral public key for zero-knowledge decryption
          encryption_version: version, // Store encryption version (3+ for zero-knowledge)
          // PHASE 1 FIX: Include recipient metadata to track exact keys used
          recipient_key_id: recipientKeyId,
          recipient_device_id: recipientDeviceId,
          is_encrypted: true,
          expiry_rule: currentExpiryRule,
          duration: duration
        })
        .select()
        .single();

      if (error) {
        // DEBUG_CHAT && console.error('[FriendChat] Error sending video message:', error);
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
        setUploadingMessageId(null);
      
      // Privacy preference is now persisted - no reset needed
        Alert.alert('Error', 'Failed to send video message');
        return;
      }

      // Update message with real ID
      const newStatus = computeMessageStatus(sentMessage, user?.id || '');
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { 
                ...msg, 
                id: sentMessage.id,
                status: newStatus
              }
            : msg
        )
      );
      setUploadingMessageId(null);
      
      // Schedule status update from 'sent' to 'delivered' after 2 seconds
      if (newStatus === 'sent') {
        scheduleStatusUpdate(sentMessage.id, 'sent', 'delivered');
      }
      
      // Privacy preference is now persisted - no reset needed

      // Send push notification
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .single();
        
        await sendMessageNotification(
          friendId,
          user.id,
          userData?.username || 'Someone',
          '📹 Video message'
        );
      } catch (notifError) {
      }
    } catch (error) {
      // DEBUG_CHAT && console.error('[FriendChat] Error sending video message:', error);
      Alert.alert('Error', 'Failed to send video message');
    }
  };

  const handleVideoRecorded = async (videoUri: string) => {
    if (!user) return;

    // Add immediate visual feedback
    const tempId = Date.now().toString();
    const tempVideoMessage: Message = {
      id: tempId,
      type: 'video',
      content: videoUri, // Local URI for now
      isMine: true,
      timestamp: new Date(),
      status: 'sending',
      duration: 0,
      expiryRule: currentExpiryRule
    };

    setMessages(prev => [...prev, tempVideoMessage]);
    setUploadingMessageId(tempId);
    flatListRef.current?.scrollToEnd();

    try {
      // Upload the video with E2E encryption using chunked approach for better reliability
      // Uses the same pattern as voice messages - deriving shared secret from user IDs
      const uploadResult = await SecureE2EVideoStorageFastAndroid.encryptAndUploadVideo(
        videoUri,
        user.id,
        friendId,
        (progress) => {
          // Update the temp message with progress
          setMessages(prev => 
            prev.map(msg => 
              msg.id === tempId 
                ? { ...msg, uploadProgress: progress * 100 }
                : msg
            )
          );
        },
        (compressionProgress) => {
          // Update the temp message with compression progress
          setMessages(prev => 
            prev.map(msg => 
              msg.id === tempId 
                ? { 
                    ...msg, 
                    compressionProgress: compressionProgress.percent,
                    compressionStatus: `Compressing... ${compressionProgress.percent}%`
                  }
                : msg
            )
          );
        }
      );
      
      if (uploadResult) {
        // Remove temporary message
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        
        // Send the actual message with encrypted data
        await handleVideoSend(
          uploadResult.videoId, // Use videoId as the path
          30, // Default 30 second duration
          uploadResult.encryptedKey,
          uploadResult.keyNonce,
          uploadResult.dataNonce, // Zero-knowledge data nonce
          uploadResult.ephemeralPublicKey, // Zero-knowledge ephemeral public key
          uploadResult.version, // Zero-knowledge encryption version
          uploadResult.recipientKeyId, // PHASE 2 FIX: Store recipient key ID
          uploadResult.recipientDeviceId // Store recipient device ID
        );
      } else {
        // Update temp message to failed
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
        setUploadingMessageId(null);
      
      // Privacy preference is now persisted - no reset needed
        Alert.alert('Error', 'Failed to upload video');
      }
    } catch (error: any) {
      console.error('Failed to send video:', error);
      // Update temp message to failed
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: 'failed' as const }
            : msg
        )
      );
      setUploadingMessageId(null);
      
      // Privacy preference is now persisted - no reset needed
      
      // Provide specific error messages based on error type
      let errorMessage = 'Failed to send video message. Please try again.';
      if (error.message?.includes('Crypto initialization failed')) {
        errorMessage = 'Video encryption is not available in Expo Go. Please try using a development build or wait for the full release version.';
      } else if (error.message?.includes('PRNG') || error.message?.includes('no PRNG')) {
        errorMessage = 'Encryption setup failed. This is likely due to Expo Go limitations. Please try restarting the app or use a development build.';
      } else if (error.message?.includes('network') || error.message?.includes('upload')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message?.includes('compression')) {
        errorMessage = 'Video compression failed. The video file might be corrupted or too large.';
      }
      
      Alert.alert('Video Send Failed', errorMessage);
    }
  };

  // Handle ephemeral message removal from UI
  const handleMessageRemoval = (messageId: string) => {
    console.log(`[FriendChat] 🗑️ RECEIVED handleMessageRemoval for: ${messageId}`);
    console.log(`[FriendChat] Current messages count: ${messages.length}`);
    console.log(`[FriendChat] Message to remove exists:`, messages.some(m => m.id === messageId));
    
    setMessages(prev => {
      const filtered = prev.filter(msg => msg.id !== messageId);
      console.log(`[FriendChat] ✅ Filtered messages: ${prev.length} → ${filtered.length}`);
      return filtered;
    });
    
    console.log(`[FriendChat] ✅ Message removal completed for: ${messageId}`);
  };

  // Handle video completion for ephemeral messages (legacy)
  const handleVideoComplete = async (messageId: string) => {
    console.log(`[FriendChat] 📹 RECEIVED VIDEO COMPLETION CALLBACK for message: ${messageId}`);
    
    if (!messageId) {
      console.log(`[FriendChat] ❌ No messageId provided to handleVideoComplete`);
      return;
    }
    
    console.log(`[FriendChat] 🔄 Processing video completion for message: ${messageId}`);
    
    try {
      // Use EphemeralMessageService to handle the completion
      console.log(`[FriendChat] 🚀 Calling EphemeralMessageService.handleVideoComplete for: ${messageId}`);
      await EphemeralMessageService.handleVideoComplete(messageId, handleMessageRemoval);
      console.log(`[FriendChat] ✅ EphemeralMessageService.handleVideoComplete completed for: ${messageId}`);
    } catch (error) {
      console.error('[FriendChat] ❌ Error handling video completion:', error);
    }
  };

  // Handle video modal close for view-once clearing (NEW)
  const handleVideoClose = async (messageId: string) => {
    console.log(`[ViewOnceClearing] 🎬 Video modal closed for message: ${messageId}`);
    
    if (!messageId || !user?.id) {
      console.log(`[ViewOnceClearing] ❌ Missing messageId or userId`);
      return;
    }
    
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        console.log(`[ViewOnceClearing] ❌ Message not found: ${messageId}`);
        return;
      }

      // Handle message consumption for video close
      await ViewOnceMessageManager.handleMessageConsumption(
        messageId,
        'video',
        message.expiryRule || { type: 'none' },
        message.sender_id || '',
        message.recipient_id || '',
        'closed'
      );
      
      console.log(`[ViewOnceClearing] ✅ Video close handling completed for: ${messageId}`);
    } catch (error) {
      console.error('[ViewOnceClearing] ❌ Error handling video close:', error);
    }
  };

  // Handle audio first play for view-once status tracking (NEW)
  const handleAudioViewed = async (messageId: string) => {
    console.log(`[ViewOnceClearing] 🎵 Audio first played for message: ${messageId}`);
    
    if (!messageId || !user?.id) {
      console.log(`[ViewOnceClearing] ❌ Missing messageId or userId`);
      return;
    }
    
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        console.log(`[ViewOnceClearing] ❌ Message not found: ${messageId}`);
        return;
      }

      // Mark as viewed and handle any immediate clearing logic
      await ViewOnceMessageManager.handleMessageConsumption(
        messageId,
        'voice',
        message.expiryRule || { type: 'none' },
        message.sender_id || '',
        message.recipient_id || '',
        'played'
      );
      
      console.log(`[ViewOnceClearing] ✅ Audio viewed handling completed for: ${messageId}`);
    } catch (error) {
      console.error('[ViewOnceClearing] ❌ Error handling audio viewed:', error);
    }
  };

  const playVoiceMessage = async (messageId: string) => {
    try {
      // Set the currently viewing message for screenshot detection
      setCurrentlyViewingMessageId(messageId);
      
      // Find the message
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // For ephemeral voice messages (view or playback), mark as viewed in database
      // The real-time subscription will handle status updates automatically
      if ((message.expiryRule?.type === 'view' || message.expiryRule?.type === 'playback') && !message.isMine) {
        // Mark as viewed in database - status will be updated via real-time subscription
        try {
          await EphemeralMessageService.markMessageViewed(messageId);
          
          // Also trigger new view-once tracking system
          await handleAudioViewed(messageId);
        } catch (error) {
          console.error('[Voice] Failed to mark message as viewed:', error);
        }
      }
      // Stop current playback if playing another message
      if (sound && playingMessageId !== messageId) {
        await sound.unloadAsync();
        setSound(null);
        clearPlayingAndViewingMessage();
      }

      // If already playing this message, pause it
      if (playingMessageId === messageId && sound) {
        const status = await sound.getStatusAsync();
        if ('isLoaded' in status && status.isLoaded) {
          if (status.isPlaying) {
            await sound.pauseAsync();
            setPlaybackStatus(prev => ({
              ...prev,
              [messageId]: { ...prev[messageId], isPlaying: false }
            }));
            return;
          } else {
            await sound.playAsync();
            setPlaybackStatus(prev => ({
              ...prev,
              [messageId]: { ...prev[messageId], isPlaying: true }
            }));
            return;
          }
        }
      }

      setPlayingMessageId(messageId);
      
      // Update playback status
      setPlaybackStatus(prev => ({
        ...prev,
        [messageId]: { isPlaying: true, progress: 0, duration: 0 }
      }));

      let audioUri: string;

      // Check if this is a local URI (for messages just sent)
      if (message.content.startsWith('file://') || message.content.startsWith('/')) {
        audioUri = message.content;
        // On iOS, ensure the file:// prefix is present
        if (Platform.OS === 'ios' && !audioUri.startsWith('file://')) {
          audioUri = 'file://' + audioUri;
        }
      } else {
        // This is a server path, need to download and decrypt
        const { data: msgData, error } = await supabase
          .from('messages')
          .select('media_path, content, nonce, data_nonce, sender_id, encryption_version, ephemeral_public_key')
          .eq('id', messageId)
          .single();

        if (error || !msgData) {
          throw new Error('Failed to get message details');
        }

        // For E2E encrypted messages, content contains the encrypted key
        if (!msgData.content || !msgData.nonce) {
          throw new Error('Missing encryption info');
        }

        // Set downloading state
        setDownloadingMessageId(messageId);

        // PHASE 1 FIX: Validate device metadata before audio decryption
        const currentDeviceKeys = await SecureDeviceKeys.getDeviceKeys();
        if (msgData.recipient_device_id && currentDeviceKeys?.deviceId !== msgData.recipient_device_id) {
          console.warn('[FriendChat] PHASE 1: Audio device ID mismatch detected!');
          console.warn(`[FriendChat] Expected device: ${msgData.recipient_device_id}`);
          console.warn(`[FriendChat] Current device: ${currentDeviceKeys?.deviceId || 'unknown'}`);
          console.warn('[FriendChat] This may cause audio decryption failure');
          console.warn('[FriendChat] Root cause: Message was encrypted for different device');
          
          // Continue anyway but log the mismatch for debugging
          console.warn('[FriendChat] Attempting audio decryption despite device mismatch...');
        } else if (msgData.recipient_device_id) {
          console.log('[FriendChat] PHASE 1: Audio device metadata validation passed ✅');
          console.log(`[FriendChat] Target device: ${msgData.recipient_device_id}`);
        } else {
          console.log('[FriendChat] PHASE 1: No audio device metadata (message from before Phase 1 fix)');
        }

        // Download and decrypt the audio using E2E encryption
        const decryptedUri = await downloadAndDecryptE2EAudio(
          msgData.media_path,
          msgData.content, // encrypted key
          msgData.nonce,
          msgData.sender_id,
          user?.id || '',
          (progress) => {
            // Update download progress
            setDownloadProgress(prev => ({
              ...prev,
              [messageId]: Math.round(progress.percentage)
            }));
          }
        );

        setDownloadingMessageId(null);
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[messageId];
          return newProgress;
        });

        if (!decryptedUri) {
          throw new Error('Failed to decrypt voice message');
        }

        audioUri = decryptedUri;
      }

      
      // Verify the file exists
      try {
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        if (!fileInfo.exists) {
          throw new Error('Audio file does not exist at path: ' + audioUri);
        }
      } catch (err) {
        console.error('[Voice] File check error:', err);
      }

      // Configure audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      // Try to create and play the audio with error handling
      let newSound: Audio.Sound;
      
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { 
            shouldPlay: true,
            isLooping: false,
            volume: 1.0
          }
        );
        newSound = sound;
      } catch (error) {
        console.error('[Voice] Failed to create sound:', error);
        
        // Try alternative approach for Android
        if (Platform.OS === 'android') {
          const sound = new Audio.Sound();
          await sound.loadAsync(
            { uri: audioUri },
            { shouldPlay: false }
          );
          
          // Set audio mode again
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            allowsRecordingIOS: false,
            staysActiveInBackground: false,
            shouldDuckAndroid: false,
          });
          
          await sound.playAsync();
          newSound = sound;
        } else {
          throw error;
        }
      }

      setSound(newSound);

      // Handle ephemeral message viewing
      const msgForEphemeral = messages.find(m => m.id === messageId);
      if (msgForEphemeral) {
        try {
          // Convert to database Message type with expiry rule
          const dbMessage = {
            id: msgForEphemeral.id,
            type: msgForEphemeral.type,
            content: msgForEphemeral.content,
            sender_id: msgForEphemeral.isMine ? user?.id || '' : friendId,
            recipient_id: msgForEphemeral.isMine ? friendId : user?.id || '',
            created_at: msgForEphemeral.timestamp.toISOString(),
            expiry_rule: msgForEphemeral.expiryRule || { type: 'none' as const },
            expired: false,
            is_encrypted: true
          };
          
          await EphemeralMessageService.handleMessageView(dbMessage, 'play');
        } catch (ephemeralError) {
          console.error('[Voice] Error handling ephemeral message:', ephemeralError);
          // Don't block playback if ephemeral handling fails
        }
      }

      // Set up status updates for progress tracking
      let hasStartedPlaying = false;
      newSound.setOnPlaybackStatusUpdate((status) => {
        try {
          if ('isLoaded' in status && status.isLoaded) {
            const progress = status.positionMillis || 0;
            const duration = status.durationMillis || 0;
            const isPlaying = status.isPlaying || false;
            
            // Android workaround: ensure playback starts
            if (!hasStartedPlaying && !isPlaying && Platform.OS === 'android' && duration > 0) {
              hasStartedPlaying = true;
              newSound.playAsync().catch(err => console.error('[Voice] Error starting playback:', err));
            }
            
            setPlaybackStatus(prev => ({
              ...prev,
              [messageId]: { isPlaying, progress, duration }
            }));

            if ('didJustFinish' in status && status.didJustFinish) {
              newSound.unloadAsync().catch(err => console.log('[Voice] Error unloading:', err));
              setSound(null);
              clearPlayingAndViewingMessage();
              setPlaybackStatus(prev => ({
                ...prev,
                [messageId]: { isPlaying: false, progress: 0, duration: duration }
              }));
              
              // Handle ephemeral voice message expiry after playback completion
              const message = messages.find(m => m.id === messageId);
              if (message && (message.expiryRule?.type === 'view' || message.expiryRule?.type === 'playback') && !message.isMine) {
                console.log(`[ViewOnceClearing] 🎵 Audio playback completed for view-once message: ${messageId}`);
                
                // Mark as viewed and trigger clearing for sender
                ViewOnceMessageManager.handleMessageConsumption(
                  messageId,
                  'voice',
                  message.expiryRule,
                  message.sender_id || '',
                  message.recipient_id || '',
                  'closed' // Audio completed playing
                ).then(() => {
                  console.log(`[ViewOnceClearing] ✅ Voice message consumption handled: ${messageId}`);
                }).catch(error => {
                  console.error('[ViewOnceClearing] ❌ Error handling voice consumption:', error);
                });
                
                // Schedule local removal based on actual audio duration + 2 second buffer
                const bufferTime = 2000; // 2 seconds buffer
                setTimeout(() => {
                  setMessages(prev => prev.filter(msg => msg.id !== messageId));
                }, bufferTime); // Give 2 second buffer after playback completes
              }
            }
          } else if ('error' in status) {
            console.error('[Voice] Playback error:', status.error);
            clearPlayingAndViewingMessage();
            setSound(null);
            setDownloadingMessageId(null);
            // Clean up the status
            setPlaybackStatus(prev => {
              const newStatus = { ...prev };
              delete newStatus[messageId];
              return newStatus;
            });
          }
        } catch (err) {
          console.error('[Voice] Status update error:', err);
        }
      });
    } catch (error: any) {
      console.error('Error playing voice message:', error);
      clearPlayingAndViewingMessage();
      setDownloadingMessageId(null);
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[messageId];
        return newProgress;
      });
      
      // Clean up any existing sound
      if (sound) {
        await sound.unloadAsync().catch(() => {});
        setSound(null);
      }
      
      // Show user-friendly error
      if (error.message?.includes('Failed to load audio')) {
        Alert.alert('Playback Error', 'Unable to play this voice message. The file may be corrupted.');
      } else {
        Alert.alert('Error', 'Failed to play voice message. Please try again.');
      }
      
      setPlaybackStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[messageId];
        return newStatus;
      });
    }
  };

  const playVideoMessage = async (messageId: string) => {
    try {
      // Set the currently viewing message for screenshot detection
      setCurrentlyViewingMessageId(messageId);
      
      // Find the message
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // For ephemeral video messages (view-once), mark as viewed in database
      // The real-time subscription will handle status updates and expiry automatically
      if ((message.expiryRule?.type === 'view') && !message.isMine) {
        // Mark as viewed in database - status will be updated via real-time subscription
        try {
          await EphemeralMessageService.markMessageViewed(messageId);
          
          // Also trigger new view-once tracking system when video opens
          await ViewOnceMessageManager.handleMessageConsumption(
            messageId,
            'video',
            message.expiryRule || { type: 'none' },
            message.sender_id || '',
            message.recipient_id || '',
            'opened'
          );
        } catch (error) {
          console.error('[Video] Failed to mark message as viewed:', error);
        }
      }
      // Set downloading state
      setDownloadingMessageId(messageId);

      let videoUri: string;

      // Check if this is a local URI (for messages just sent)
      if (message.content.startsWith('file://') || message.content.startsWith('/')) {
        videoUri = message.content;
        // On iOS, ensure the file:// prefix is present
        if (Platform.OS === 'ios' && !videoUri.startsWith('file://')) {
          videoUri = 'file://' + videoUri;
        }
      } else {
        // This is a server path, need to download and decrypt
        const { data: msgData, error } = await supabase
          .from('messages')
          .select('media_path, content, nonce, data_nonce, sender_id, encryption_version, ephemeral_public_key')
          .eq('id', messageId)
          .single();

        if (error || !msgData) {
          throw new Error('Failed to get message details');
        }

        // For E2E encrypted messages, content contains the encrypted key
        if (!msgData.content || !msgData.nonce) {
          throw new Error('Missing encryption info');
        }

        // Download and decrypt the video using the same pattern as voice messages
        // Always pass sender_id first, then recipient_id (current user)
        
        // Parse nonce data properly for video decryption compatibility
        // Video messages store nonces differently than audio messages
        let keyNonce = msgData.nonce;
        let dataNonce = msgData.data_nonce;
        let ephemeralPublicKey = msgData.ephemeral_public_key;
        
        // Handle legacy audio-style JSON nonce format for backward compatibility
        if (msgData.nonce && msgData.nonce.startsWith('{')) {
          try {
            const nonceData = JSON.parse(msgData.nonce);
            keyNonce = nonceData.keyNonce || nonceData.nonce;
            dataNonce = dataNonce || nonceData.dataNonce;
            ephemeralPublicKey = ephemeralPublicKey || nonceData.ephemeralPublicKey;
          } catch (error) {
            console.error('[Video Download] Failed to parse legacy nonce JSON:', error);
            // Continue with raw values
          }
        }
        
        console.log('[Video Download] Decryption parameters:');
        console.log('- videoId:', msgData.media_path);
        console.log('- encryptedKey length:', msgData.content?.length || 0);
        console.log('- keyNonce length:', keyNonce?.length || 0);
        console.log('- dataNonce length:', dataNonce?.length || 0);
        console.log('- ephemeralPublicKey length:', ephemeralPublicKey?.length || 0);
        console.log('- version:', msgData.encryption_version || 1);
        console.log('- recipient_device_id:', msgData.recipient_device_id || 'none');
        console.log('- recipient_key_id:', msgData.recipient_key_id || 'none');
        
        // PHASE 1 FIX: Validate device metadata before decryption
        const currentDeviceKeys = await SecureDeviceKeys.getDeviceKeys();
        if (msgData.recipient_device_id && currentDeviceKeys?.deviceId !== msgData.recipient_device_id) {
          console.warn('[FriendChat] PHASE 1: Device ID mismatch detected!');
          console.warn(`[FriendChat] Expected device: ${msgData.recipient_device_id}`);
          console.warn(`[FriendChat] Current device: ${currentDeviceKeys?.deviceId || 'unknown'}`);
          console.warn('[FriendChat] This may cause "nacl.box.open returned null" error');
          console.warn('[FriendChat] Root cause: Message was encrypted for different device');
          
          // Continue anyway but log the mismatch for debugging
          console.warn('[FriendChat] Attempting decryption despite device mismatch...');
        } else if (msgData.recipient_device_id) {
          console.log('[FriendChat] PHASE 1: Device metadata validation passed ✅');
          console.log(`[FriendChat] Target device: ${msgData.recipient_device_id}`);
        } else {
          console.log('[FriendChat] PHASE 1: No device metadata available (message from before Phase 1 fix)');
        }
        
        const decryptedUri = await SecureE2EVideoStorageFastAndroid.downloadAndDecryptVideo(
          msgData.media_path, // This is now the videoId
          msgData.content,    // encrypted key
          keyNonce,           // key nonce (properly parsed)
          msgData.sender_id,  // sender is always the person who sent the message
          user?.id || '',     // recipient is always the current user when downloading
          (progress) => {
            // Could update UI with download progress here if needed
          },
          dataNonce,          // Zero-knowledge data nonce (properly parsed)
          ephemeralPublicKey, // Zero-knowledge ephemeral public key (properly parsed)
          msgData.encryption_version || 1, // Encryption version (default to legacy if not set)
          msgData.recipient_key_id,        // PHASE 2 FIX: Pass recipient key ID for validation
          msgData.recipient_device_id      // Pass recipient device ID for validation
        );

        setDownloadingMessageId(null);

        if (!decryptedUri) {
          throw new Error('Failed to decrypt video message');
        }

        videoUri = decryptedUri;
      }

      
      // Verify the file exists before playing
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      
      if (!fileInfo.exists) {
        console.error('[Video] File does not exist!');
        Alert.alert('Error', 'Video file not found');
        return;
      }
      
      // Handle ephemeral message viewing before opening player
      const msgForEphemeral = messages.find(m => m.id === messageId);
      if (msgForEphemeral) {
        try {
          // Convert to database Message type with expiry rule
          const dbMessage = {
            id: msgForEphemeral.id,
            type: msgForEphemeral.type,
            content: msgForEphemeral.content,
            sender_id: msgForEphemeral.isMine ? user?.id || '' : friendId,
            recipient_id: msgForEphemeral.isMine ? friendId : user?.id || '',
            created_at: msgForEphemeral.timestamp.toISOString(),
            expiry_rule: msgForEphemeral.expiryRule || { type: 'none' as const },
            expired: false,
            is_encrypted: true
          };
          
          await EphemeralMessageService.handleMessageView(dbMessage, 'view');
        } catch (ephemeralError) {
          console.error('[Video] Error handling ephemeral message:', ephemeralError);
          // Don't block video playback if ephemeral handling fails
        }
      }
      
      // Open video player modal
      console.log(`[FriendChat] 🎬 Opening video player for messageId: ${messageId}`);
      setCurrentVideoUri(videoUri);
      setCurrentlyViewingMessageId(messageId); // Set the message ID for ephemeral handling
      console.log(`[FriendChat] 📝 Set currentlyViewingMessageId to: ${messageId}`);
      setShowVideoPlayer(true);
      
    } catch (error: any) {
      console.error('[Video Download] Failed:', error);
      console.error('[Video Download] Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        isTrusted: error?.isTrusted
      });
      setDownloadingMessageId(null);
      Alert.alert('Error', error?.message || 'Failed to play video message');
    }
  };

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };


  const renderMessage = ({ item }: { item: Message }) => {
    const status = playbackStatus[item.id];
    const isCurrentlyPlaying = playingMessageId === item.id && status?.isPlaying;
    const isUploading = uploadingMessageId === item.id;
    const isDownloading = downloadingMessageId === item.id;

    if (item.type === 'text') {
      // Use EphemeralMessageBubble for text messages
      return (
        <EphemeralMessageBubble
          content={item.content}
          isMine={item.isMine}
          timestamp={item.timestamp}
          expiryRule={item.expiryRule}
          isEphemeral={!!item.expiryRule && item.expiryRule.type !== 'none'}
          hasBeenViewed={item.status === 'read' || item.hasBeenViewed}
          isExpired={false} // TODO: Add proper expiry logic
          messageType={item.type}
          blurBeforeView={item.expiryRule?.type === 'view' && !item.isMine && item.status !== 'read'}
          status={item.status}
          onPress={async () => {
            // Set the currently viewing message for screenshot detection
            setCurrentlyViewingMessageId(item.id);
            
            // For view-once messages, mark as viewed in database
            // The real-time subscription will handle status updates automatically
            if (item.expiryRule?.type === 'view' && !item.isMine && item.status !== 'read') {
              // Mark as viewed in database - status will be updated via real-time subscription
              try {
                await EphemeralMessageService.markMessageViewed(item.id);
              } catch (error) {
                // DEBUG_CHAT && console.error('[FriendChat] Failed to mark message as viewed:', error);
              }
              
              // For view-once messages, schedule expiry after a short delay
              setTimeout(() => {
                setMessages(prev => prev.filter(msg => msg.id !== item.id));
                setCurrentlyViewingMessageId(null); // Clear when message expires
              }, 5000); // 5 second viewing time
            } else {
              // For non-ephemeral messages, clear viewing context after a short delay
              setTimeout(() => {
                setCurrentlyViewingMessageId(null);
              }, 3000);
            }
          }}
          onExpire={() => {
            // Remove expired message from the list
            setMessages(prev => prev.filter(msg => msg.id !== item.id));
          }}
        />
      );
    } else if (item.type === 'voice') {
      // Use EphemeralMessageBubble for voice messages
      return (
        <EphemeralMessageBubble
          content={isUploading ? 'Sending voice message...' : 
                  isDownloading ? `Downloading... ${downloadProgress[item.id] || 0}%` :
                  `Voice message • ${item.duration || 0}s`}
          isMine={item.isMine}
          timestamp={item.timestamp}
          expiryRule={item.expiryRule}
          isEphemeral={!!item.expiryRule && item.expiryRule.type !== 'none'}
          hasBeenViewed={item.status === 'read' || item.hasBeenViewed}
          isExpired={false}
          messageType={item.type}
          blurBeforeView={item.expiryRule?.type === 'view' && !item.isMine && item.status !== 'read'}
          status={item.status}
          onPress={() => playVoiceMessage(item.id)}
          onExpire={() => {
            // Remove expired message from the list
            setMessages(prev => prev.filter(msg => msg.id !== item.id));
          }}
        />
      );
    } else if (item.type === 'video') {
      // Use EphemeralMessageBubble for video messages
      return (
        <EphemeralMessageBubble
          content={isUploading ? 'Sending video message...' : 
                  isDownloading ? `Loading video...` :
                  `Video message • ${item.duration || 30}s`}
          isMine={item.isMine}
          timestamp={item.timestamp}
          expiryRule={item.expiryRule}
          isEphemeral={!!item.expiryRule && item.expiryRule.type !== 'none'}
          hasBeenViewed={item.status === 'read' || item.hasBeenViewed}
          isExpired={false}
          messageType={item.type}
          blurBeforeView={item.expiryRule?.type === 'view' && !item.isMine && item.status !== 'read'}
          status={item.status}
          onPress={() => playVideoMessage(item.id)}
          onExpire={() => {
            // Remove expired message from the list
            setMessages(prev => prev.filter(msg => msg.id !== item.id));
          }}
        />
      );
    }

    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.text.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* SHELVED: Screenshot prevention feature - SecureScreen component commented out
      <SecureScreen
        screenName="FriendChat"
        showSecurityIndicator={true}
        showEducation={false}
      >
      */}
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
          
          {/* SHELVED: Screenshot prevention feature - SecurityNotificationManagerEnhanced commented out
          Enhanced cross-device screenshot notification manager
          <SecurityNotificationManagerEnhanced
            enabled={true}
            onScreenshotDetected={(data) => {
              console.log('[FriendChat] Screenshot notification received for our message:', data);
            }}
          />
          */}
          
{/* Debug header removed - was causing visual issues */}
          
          <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.colors.background.secondary, borderBottomColor: theme.colors.border.default }]}>
          <Pressable 
            testID="friendChat_backButton"
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </Pressable>
          
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
              {friendName}
            </Text>
            {friendUsername && (
              <Text style={[styles.headerSubtitle, { 
                color: theme.colors.text.accent,
                fontWeight: 'bold' 
              }]}>
                @{friendUsername}
              </Text>
            )}
          </View>

          <View style={styles.headerActions}>
            {/* DEBUG: Temporary debug button for view-once clearing issues */}
            <TouchableOpacity
              onPress={() => {
                console.log('🔬 Running View-Once Clearing Debug...');
                ViewOnceClearingDebugger.quickDiagnostic();
              }}
              style={{ marginRight: 8, padding: 4 }}
            >
              <Text style={{ fontSize: 12, color: '#ff4444' }}>🐛</Text>
            </TouchableOpacity>
            
            <EphemeralHeaderToggle
              currentRule={currentExpiryRule}
              onPress={() => {
                // Single tap opens expiry selector
                const msgType = inputText.trim() ? 'text' : 'voice';
                setMessageTypeForExpiry(msgType);
                setShowExpirySelector(true);
              }}
            />
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="information-circle-outline" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.messagesList, { backgroundColor: theme.colors.background.primary }]}
          style={{ backgroundColor: theme.colors.background.primary }}
          onContentSizeChange={() => {
            if (!loadingMore) {
              flatListRef.current?.scrollToEnd();
            }
          }}
          onEndReachedThreshold={0.1}
          ListHeaderComponent={
            hasMoreMessages ? (
              <TouchableOpacity
                style={[styles.loadMoreButton, { backgroundColor: theme.colors.background.tertiary }]}
                onPress={() => loadMessages(true)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={theme.colors.text.accent} />
                ) : (
                  <Text style={[styles.loadMoreText, { color: theme.colors.text.accent }]}>Load earlier messages</Text>
                )}
              </TouchableOpacity>
            ) : messages.length > 0 ? (
              <View style={styles.noMoreMessages}>
                <Text style={[styles.noMoreText, { color: theme.colors.text.tertiary }]}>Beginning of conversation</Text>
              </View>
            ) : null
          }
        />


        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.background.secondary, borderTopColor: theme.colors.border.default }]}>
          {!isRecording ? (
            <>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: theme.colors.background.tertiary, 
                  color: theme.colors.text.primary 
                }]}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                placeholderTextColor={theme.colors.text.tertiary}
                multiline
                maxLength={500}
              />
              
              {inputText.trim() ? (
                <Pressable 
                  testID="friendChat_sendButton"
                  onPress={sendTextMessage} 
                  style={styles.sendButton}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                >
                  <Ionicons name="send" size={24} color={theme.colors.text.accent} />
                </Pressable>
              ) : (
                <View style={styles.mediaButtons}>
                  <TouchableOpacity
                    onPress={() => {
                      setMessageTypeForExpiry('video');
                      setShowVideoModal(true);
                    }}
                    style={[styles.videoButton, { backgroundColor: theme.colors.background.tertiary }]}
                  >
                    <Ionicons name="videocam" size={24} color={theme.colors.text.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setMessageTypeForExpiry('voice');
                      startRecording();
                    }}
                    style={[styles.micButton, { backgroundColor: theme.colors.background.tertiary }]}
                  >
                    <Ionicons name="mic" size={24} color={theme.colors.text.accent} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={styles.recordingContainer}>
              {/* Cancel button */}
              <TouchableOpacity
                onPress={cancelRecording}
                style={[styles.cancelRecordingButton, { backgroundColor: theme.colors.status.error + '20' }]}
              >
                <Ionicons name="trash-outline" size={20} color={theme.colors.status.error} />
              </TouchableOpacity>

              {/* Recording info */}
              <View style={styles.recordingInfo}>
                <View style={styles.recordingHeader}>
                  <Animated.View 
                    style={[
                      styles.recordingDot,
                      {
                        opacity: recordingDuration % 2 ? 1 : 0.3,
                        backgroundColor: theme.colors.status.error
                      }
                    ]} 
                  />
                  <Text style={[styles.recordingTime, { color: theme.colors.text.primary }]}>
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
                
                {/* Enhanced Waveform visualization */}
                <View style={styles.waveformContainer}>
                  {waveformAnimations.map((anim, i) => {
                    // Create color gradient effect across the waveform
                    const getBarColor = (index: number) => {
                      const colors = [
                        theme.colors.text.accent, // Electric purple
                        theme.colors.text.accentSecondary || theme.colors.text.accent, // Neon pink
                        theme.colors.text.accentTertiary || theme.colors.text.accent, // Cyber blue
                      ];
                      return colors[index % colors.length];
                    };
                    
                    return (
                      <Animated.View
                        key={i}
                        style={[
                          styles.waveformBar,
                          {
                            height: anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [8, 25],
                            }),
                            opacity: recordingDuration > 0 ? 0.9 : 0.3,
                            backgroundColor: getBarColor(i),
                            shadowColor: getBarColor(i),
                            shadowOpacity: recordingDuration > 0 ? 0.6 : 0,
                            shadowRadius: 3,
                            elevation: recordingDuration > 0 ? 3 : 0,
                          }
                        ]}
                      />
                    );
                  })}
                </View>
                
                <Text style={[styles.recordingHint, { color: theme.colors.text.secondary }]}>Tap send when ready</Text>
              </View>

              {/* Enhanced Send button with glow effect */}
              <Animated.View
                style={[
                  styles.sendVoiceButton,
                  {
                    backgroundColor: theme.colors.text.accent,
                    shadowColor: theme.colors.text.accent,
                    shadowOpacity: recordButtonGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.8],
                    }),
                    shadowRadius: recordButtonGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [4, 12],
                    }),
                    elevation: recordButtonGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [3, 8],
                    }),
                  }
                ]}
              >
                <TouchableOpacity
                  onPress={stopRecording}
                  style={styles.sendVoiceButtonInner}
                  activeOpacity={0.8}
                >
                  <Animated.View
                    style={{
                      transform: [{ scale: micScale }]
                    }}
                  >
                    <Ionicons name="send" size={24} color={theme.colors.text.inverse} />
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Recording Modal */}
      <RecordingModal
        visible={showRecordingModal}
        recipientName={friendName}
        recipientId={friendId}
        userId={user?.id || ''}
        onClose={() => setShowRecordingModal(false)}
        onSend={handleVoiceSend}
      />

      {/* Video Recording Modal */}
      {showVideoModal && (
        <VideoRecordingModal
          visible={showVideoModal}
          onClose={() => setShowVideoModal(false)}
          onVideoRecorded={handleVideoRecorded}
          maxDuration={30}
        />
      )}

      {/* Video Player Modal */}
      {showVideoPlayer && currentVideoUri && (
        <VideoPlayerModal
          visible={showVideoPlayer}
          videoUri={currentVideoUri}
          messageId={currentlyViewingMessageId}
          senderId={messages.find(m => m.id === currentlyViewingMessageId)?.sender_id}
          onClose={() => {
            setShowVideoPlayer(false);
            setCurrentVideoUri(null);
            setCurrentlyViewingMessageId(null);
          }}
          onVideoComplete={handleVideoComplete}
          onVideoClose={handleVideoClose}
        />
      )}
      
      {/* Expiry Rule Selector */}
      <ExpiryRuleSelector
        visible={showExpirySelector}
        onClose={() => {
          setShowExpirySelector(false);
        }}
        onSelect={async (rule) => {
          await updatePrivacyRule(rule);
          setShowExpirySelector(false);
        }}
        messageType={messageTypeForExpiry}
        currentRule={currentExpiryRule}
      />
      
    </SafeAreaView>
    {/* SHELVED: Screenshot prevention feature - SecureScreen component commented out
    </SecureScreen>
    */}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor removed - now using theme.colors.background.primary
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    // backgroundColor removed - now using theme.colors.background.secondary
    borderBottomWidth: 1,
    // borderBottomColor removed - now using theme.colors.border.default
  },
  headerCenter: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    // color removed - now using theme.colors.text.primary
  },
  headerSubtitle: {
    fontSize: 12,
    // color removed - now using theme.colors.text.secondary
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 20,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  myMessage: {
    alignSelf: 'flex-end',
    // backgroundColor removed - now using theme.colors.chat.sent
  },
  theirMessage: {
    alignSelf: 'flex-start',
    // backgroundColor removed - now using theme.colors.chat.received
  },
  messageText: {
    fontSize: 16,
    // color removed - handled by theme in components
    flex: 1,
  },
  myMessageText: {
    // color removed - now using theme.colors.chat.sentText
  },
  voiceMessageBubble: {
    minWidth: 200,
    maxWidth: '85%',
  },
  videoMessage: {
    width: 200,
    height: 150,
  },
  videoThumbnailContainer: {
    flex: 1,
    backgroundColor: '#000', // Keep black for video background
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  videoUploadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 8,
    fontSize: 12,
    // color removed - now using theme colors
  },
  uploadingTextMine: {
    // color removed - now using theme colors with opacity
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDurationContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDuration: {
    fontSize: 11,
    color: 'white',
  },
  videoDurationMine: {
    // Already white
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  voiceMessageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  voiceMessageContent: {
    flex: 1,
    marginLeft: 12,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  playButtonMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  playButtonTheirs: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    gap: 3,
    marginBottom: 4,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
    // backgroundColor removed - now using theme.colors.text.accent
  },
  voiceDuration: {
    fontSize: 12,
    opacity: 0.8,
  },
  voiceDurationMine: {
    // color removed - now using theme.colors.chat.sentText
  },
  voiceDurationTheirs: {
    // color removed - now using theme.colors.chat.receivedText
  },
  sendingIndicator: {
    marginLeft: 8,
  },
  statusIndicator: {
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    // backgroundColor removed - now using theme.colors.background.secondary
    borderTopWidth: 1,
    // borderTopColor removed - now using theme.colors.border.default
    minHeight: 68,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    // backgroundColor removed - now using theme.colors.background.tertiary
    borderRadius: 20,
    fontSize: 16,
    // color handled by theme in component
  },
  sendButton: {
    marginLeft: 8,
    padding: 8,
  },
  mediaButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor removed - now using theme.colors.background.tertiary
    borderRadius: 20,
  },
  micButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor removed - now using theme.colors.background.tertiary
    borderRadius: 20,
  },
  micButtonPressed: {
    // backgroundColor removed - now using theme.colors.text.accent
    transform: [{ scale: 0.95 }],
  },
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  recordingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    padding: 4,
  },
  cancelButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    // backgroundColor removed - now using theme.colors.status.error with opacity
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    // backgroundColor handled by theme in component
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: '600',
    // color removed - now using theme.colors.text.primary
    minWidth: 45,
  },
  recordingHint: {
    fontSize: 12,
    // color removed - now using theme.colors.text.secondary
    marginTop: 4,
  },
  slideToCancel: {
    fontSize: 14,
    // color removed - now using theme.colors.text.secondary
    marginLeft: 16,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  recordingMicButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    // backgroundColor removed - now using theme.colors.text.accent
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  cancelRecordingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // backgroundColor removed - now using theme.colors.status.error with opacity
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  recordingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sendVoiceButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    // backgroundColor removed - now using theme.colors.text.accent
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sendVoiceButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    // backgroundColor removed - now using theme.colors.background.tertiary
    borderRadius: 20,
    marginVertical: 10,
    alignSelf: 'center',
  },
  loadMoreText: {
    // color removed - now using theme.colors.text.accent
    fontSize: 14,
    fontWeight: '600',
  },
  noMoreMessages: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noMoreText: {
    // color removed - now using theme.colors.text.tertiary
    fontSize: 14,
  },
  viewOnceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  viewOnceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  viewOnceIndicatorVideo: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewOnceTextVideo: {
    fontSize: 11,
    fontWeight: '500',
    color: 'white',
  },
  viewOnceIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 12,
    height: 12,
    marginRight: 4,
  },
  viewOnceNumberText: {
    position: 'absolute',
    fontSize: 6,
    fontWeight: 'bold',
    textAlign: 'center',
    top: 1,
    left: 0,
    right: 0,
  },
  viewOnceVideoIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
    marginRight: 6,
  },
  viewOnceVideoNumber: {
    position: 'absolute',
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
    color: 'white',
    top: 1.5,
    left: 0,
    right: 0,
  },
  debugHeader: {
    padding: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff20',
  },
  debugHeaderText: {
    fontSize: 12,
    fontWeight: '500',
  },
});