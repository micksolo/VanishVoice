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
import FriendEncryption from '../utils/friendEncryption';
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
import messageClearingService from '../services/messageClearingService';
import { filterExpiredMessages, areMessageArraysEquivalent } from '../utils/messageFiltering';
import { computeMessageStatus } from '../utils/messageStatus';

// Storage key for persisting user's privacy preference
const PRIVACY_PREFERENCE_KEY = '@wyd_privacy_preference';

interface Message {
  id: string;
  type: 'text' | 'voice' | 'video';
  content: string;
  isMine: boolean;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  duration?: number; // Duration in seconds for voice/video messages
  uploadProgress?: number; // Upload progress percentage
  expiryRule?: ExpiryRule; // Expiry rule for ephemeral messages
  isEphemeral?: boolean; // Whether message is ephemeral
  timeRemaining?: number; // Time remaining until expiry (milliseconds)
  hasBeenViewed?: boolean; // For sender to know when recipient viewed message
}

const PAGE_SIZE = 20;

export default function FriendChatScreen({ route, navigation }: any) {
  const { friendId, friendName, friendUsername } = route.params;
  const { user } = useAuth();
  const theme = useAppTheme();
  
  const [messages, setMessages] = useState<Message[]>([]);
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

  // Load user's privacy preference on component mount
  useEffect(() => {
    const loadPrivacyPreference = async () => {
      try {
        console.log('[FriendChat] Loading privacy preference from AsyncStorage...');
        const storedPreference = await AsyncStorage.getItem(PRIVACY_PREFERENCE_KEY);
        console.log('[FriendChat] Raw stored preference:', storedPreference);
        
        if (storedPreference) {
          const parsedPreference = JSON.parse(storedPreference) as ExpiryRule;
          console.log('[FriendChat] Successfully parsed preference:', JSON.stringify(parsedPreference));
          setCurrentExpiryRule(parsedPreference);
          console.log('[FriendChat] Privacy preference applied to state');
        } else {
          console.log('[FriendChat] No stored preference found, keeping default view-once');
        }
      } catch (error) {
        console.error('[FriendChat] Error loading privacy preference:', error);
        console.log('[FriendChat] Keeping default view-once due to error');
      } finally {
        setPrivacyPreferenceLoaded(true);
        console.log('[FriendChat] Privacy preference loading completed');
      }
    };
    
    loadPrivacyPreference();
  }, []);

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
      console.log('[FriendChat] Saving privacy preference:', ruleString);
      await AsyncStorage.setItem(PRIVACY_PREFERENCE_KEY, ruleString);
      console.log('[FriendChat] Successfully saved privacy preference to AsyncStorage');
      
      // Verify the save by reading it back
      const verification = await AsyncStorage.getItem(PRIVACY_PREFERENCE_KEY);
      console.log('[FriendChat] Verification read:', verification);
    } catch (error) {
      console.error('[FriendChat] Error saving privacy preference:', error);
    }
  };

  // Enhanced function to update privacy rule and persist it
  const updatePrivacyRule = async (rule: ExpiryRule) => {
    setCurrentExpiryRule(rule);
    await savePrivacyPreference(rule);
  };

  const initializeChat = async () => {
    try {
      console.log('[FriendChat] Initializing chat with friend:', friendId);
      
      if (!user) {
        throw new Error('No user available');
      }

      // No need to initialize encryption anymore - shared secret works immediately

      // Load existing messages
      await loadMessages();
      
      // Subscribe to new messages
      const unsubscribe = subscribeToMessages();
      
      // Start polling for new messages as fallback
      messagePollingInterval.current = setInterval(checkForNewMessages, 3000);
      
      // Subscribe to message clearing events
      const unsubscribeClearing = messageClearingService.subscribeToMessageClearing(() => {
        console.log('[FriendChat] Received message clearing event, clearing local messages');
        setMessages([]);
        setMessageOffset(0);
        setHasMoreMessages(true);
        lastMessageCount.current = 0;
      });
      
      setLoading(false);
      
      return () => {
        unsubscribe();
        unsubscribeClearing();
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
      
      console.log('[FriendChat] Loading messages between user and friend:', user?.id, friendId);
      console.log('[FriendChat] Offset:', currentOffset, 'Limit:', PAGE_SIZE);
      
      // Load messages from the database with pagination
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1);

      if (error) {
        console.error('[FriendChat] Error loading messages:', error);
        return;
      }

      console.log('[FriendChat] Loaded messages:', data?.length || 0);
      
      // Check if we have more messages
      if (data && data.length < PAGE_SIZE) {
        setHasMoreMessages(false);
      }
      
      // Reverse the messages to show oldest first
      const reversedData = data ? [...data].reverse() : [];

      // Filter expired messages using utility function
      const filteredMessages = filterExpiredMessages(reversedData || []);
      console.log('[FriendChat] After filtering expired messages:', filteredMessages?.length || 0);

      // Mark all messages from friend as read
      if (reversedData && reversedData.length > 0) {
        const unreadMessageIds = reversedData
          .filter(msg => msg.sender_id === friendId && !msg.read_at)
          .map(msg => msg.id);

        if (unreadMessageIds.length > 0) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .in('id', unreadMessageIds);

          if (updateError) {
            console.error('[FriendChat] Error marking messages as read:', updateError);
          } else {
            // Handle ephemeral messages for text messages that were just marked as read
            console.log('[FriendChat] Handling ephemeral text messages after marking as read');
            try {
              for (const messageId of unreadMessageIds) {
                await EphemeralMessageService.markMessageViewed(messageId);
              }
            } catch (ephemeralError) {
              console.error('[FriendChat] Error handling ephemeral text messages:', ephemeralError);
              // Don't block message loading if ephemeral handling fails
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
              console.log('[FriendChat] Decrypting encrypted message');
              console.log('[FriendChat] Message ID:', msg.id);
              console.log('[FriendChat] Is encrypted:', msg.is_encrypted);
              console.log('[FriendChat] Has nonce:', !!msg.nonce);
              
              // Decrypt the message
              // For decryption, we need to use the sender's ID and our ID in the right order
              const senderId = msg.sender_id;
              const recipientId = msg.recipient_id;
              
              console.log('[FriendChat] Sender ID:', senderId);
              console.log('[FriendChat] Recipient ID:', recipientId);
              console.log('[FriendChat] My ID:', user?.id);
              
              const decrypted = await FriendEncryption.decryptMessage(
                msg.content,
                msg.nonce,
                msg.ephemeral_public_key || '',
                senderId === user?.id ? recipientId : senderId, // friendId
                user?.id || ''
              );
              
              console.log('[FriendChat] Decryption result:', decrypted);
              content = decrypted || msg.content; // Fallback to encrypted content if decryption fails
            } catch (error) {
              console.error('[FriendChat] Failed to decrypt message:', error);
              content = '[Failed to decrypt]';
            }
          } else {
            // Plain text message (legacy)
            console.log('[FriendChat] Loading plain text message (legacy)');
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
          hasBeenViewed: msg.sender_id === user?.id && msg.viewed_at !== null
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
      console.error('[FriendChat] Error in loadMessages:', error);
      console.error('[FriendChat] Error stack:', error.stack);
      console.error('[FriendChat] convertedMessages at error:', convertedMessages);
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
      // Check for new messages since last check
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[FriendChat] Error checking for new messages:', error);
        return;
      }

      // Filter expired messages using utility function
      const nonExpiredMessages = filterExpiredMessages(data || []);
      
      const currentCount = nonExpiredMessages.length;
      
      if (currentCount !== lastMessageCount.current) {
        console.log('[FriendChat] Message count changed via polling!');
        
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
                console.error('[FriendChat] Failed to decrypt message:', error);
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
            status: computeMessageStatus(msg, user?.id || ''),
            duration: msg.duration,
            expiryRule: msg.expiry_rule,
            isEphemeral: msg.expiry_rule && msg.expiry_rule.type !== 'none',
            hasBeenViewed: msg.sender_id === user?.id && msg.viewed_at !== null
          });
        }

        // Only update if we have different messages (avoid unnecessary re-renders)
        if (!areMessageArraysEquivalent(messages, convertedMessages)) {
          setMessages(convertedMessages);
          lastMessageCount.current = currentCount;
          flatListRef.current?.scrollToEnd();
        }
      }
    } catch (error) {
      console.error('[FriendChat] Error in checkForNewMessages:', error);
    }
  };

  const subscribeToMessages = () => {
    console.log('[FriendChat] Setting up message subscription');
    console.log('[FriendChat] User ID:', user?.id);
    console.log('[FriendChat] Friend ID:', friendId);
    
    // Create a consistent channel name regardless of who is user/friend
    const channelName = [user?.id, friendId].sort().join('-');
    console.log('[FriendChat] Channel name:', `friend-chat:${channelName}`);
    
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
          console.log('[FriendChat] New message received:', payload);
          
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
                  console.error('[FriendChat] Failed to decrypt real-time message:', error);
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
        console.log('[FriendChat] Subscription status:', status);
      });

    // Also subscribe to message expiry for ephemeral messages
    const expirySubscription = EphemeralMessageService.subscribeToMessageExpiry((expiredMessageId) => {
      console.log('[FriendChat] Message expired, removing from UI:', expiredMessageId);
      setMessages(prev => prev.filter(msg => msg.id !== expiredMessageId));
    });

    // Subscribe to message updates to detect when messages are marked as expired
    const messageUpdateSubscription = supabase
      .channel(`message-updates:${channelName}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          console.log('[FriendChat] Message updated:', payload);
          
          // Check if the message is now expired or viewed (for view-once)
          if (payload.new.expired || 
              (payload.new.expiry_rule?.type === 'view' && payload.new.viewed_at)) {
            console.log('[FriendChat] Message marked as expired/viewed, removing:', payload.new.id);
            setMessages(prev => prev.filter(msg => msg.id !== payload.new.id));
          }
          
          // For sender: Update message status when recipient views/reads it
          const wasRead = payload.new.read_at && !payload.old.read_at;
          const wasViewed = payload.new.viewed_at && !payload.old.viewed_at;
          const wasListened = payload.new.listened_at && !payload.old.listened_at;
          
          if (payload.new.sender_id === user?.id && (wasRead || wasViewed || wasListened)) {
            console.log('[FriendChat] Recipient interacted with message, updating status:', payload.new.id);
            const newStatus = computeMessageStatus(payload.new, user?.id || '');
            setMessages(prev => prev.map(msg => 
              msg.id === payload.new.id 
                ? { ...msg, status: newStatus, hasBeenViewed: true }
                : msg
            ));
            
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
      .subscribe();

    return () => {
      subscription.unsubscribe();
      expirySubscription.unsubscribe();
      messageUpdateSubscription.unsubscribe();
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
          console.log('[FriendChat] Push notification failed:', pushError);
          // Don't fail the message send if push fails
        }
      }

      if (error) {
        console.error('[FriendChat] Error sending message:', error);
        
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
      
      // Reset swipe position
      swipeX.setValue(0);
      setShouldCancel(false);
      
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone access');
        return;
      }

      // Configure audio for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      // Use a simpler, more compatible recording preset
      const recordingOptions = Audio.RecordingOptionsPresets.HIGH_QUALITY;

      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);

      setRecording(newRecording);
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingDuration(0);

      // Animate mic button and start waveform
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
        // Start glowing effect
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
        ),
      ]).start();

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

      // Start duration timer
      recordingInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording', error);
      Alert.alert('Error', 'Failed to start recording');
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
        // Remove the temporary message
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        setUploadingMessageId(null);
      
      // Privacy preference is now persisted - no reset needed
        
        // Send the actual message
        await handleVoiceSend(
          uploadResult.path,
          finalDuration,
          uploadResult.encryptedKey,
          uploadResult.nonce,
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

      console.log('[Upload] Setting uploading message ID:', tempId);
      setMessages(prev => [...prev, voiceMessage]);
      setUploadingMessageId(tempId);
      flatListRef.current?.scrollToEnd();

      // Send to database - store encrypted key and nonce for E2E encryption
      const { data: sentMessage, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: friendId,
          type: 'voice',
          media_path: audioPath,
          content: encryptedKey, // Store encrypted key in content field
          nonce: nonce, // Store nonce
          is_encrypted: true,
          expiry_rule: currentExpiryRule.type === 'view' ? { type: 'playback' } : currentExpiryRule,
          duration: messageDuration || duration
        })
        .select()
        .single();

      if (error) {
        console.error('[FriendChat] Error sending voice message:', error);
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
        console.log('[FriendChat] Push notification failed:', pushError);
      }

      // Close the modal
      setShowRecordingModal(false);
    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Error', 'Failed to send voice message');
    }
  };

  const handleVideoSend = async (videoPath: string, duration: number, encryptedKey: string, nonce: string, videoNonce?: string) => {
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

      console.log('[Upload] Setting uploading message ID:', tempId);
      setMessages(prev => [...prev, videoMessage]);
      setUploadingMessageId(tempId);
      flatListRef.current?.scrollToEnd();

      // Send to database - store encrypted key and nonce for E2E encryption
      const { data: sentMessage, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: friendId,
          type: 'video',
          media_path: videoPath,
          content: encryptedKey, // Store encrypted key in content field
          nonce: nonce, // Store nonce
          video_nonce: videoNonce, // Store video-specific nonce for fast decryption
          is_encrypted: true,
          expiry_rule: currentExpiryRule,
          duration: duration
        })
        .select()
        .single();

      if (error) {
        console.error('[FriendChat] Error sending video message:', error);
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
        console.log('[FriendChat] Error sending notification:', notifError);
      }
    } catch (error) {
      console.error('[FriendChat] Error sending video message:', error);
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
          uploadResult.videoNonce // Pass the video-specific nonce
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

  const playVoiceMessage = async (messageId: string) => {
    try {
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
        } catch (error) {
          console.error('[Voice] Failed to mark message as viewed:', error);
        }
      }
      // Stop current playback if playing another message
      if (sound && playingMessageId !== messageId) {
        console.log('[Voice] Stopping previous playback');
        await sound.unloadAsync();
        setSound(null);
        setPlayingMessageId(null);
      }

      // If already playing this message, pause it
      if (playingMessageId === messageId && sound) {
        const status = await sound.getStatusAsync();
        if ('isLoaded' in status && status.isLoaded) {
          if (status.isPlaying) {
            console.log('[Voice] Pausing current playback');
            await sound.pauseAsync();
            setPlaybackStatus(prev => ({
              ...prev,
              [messageId]: { ...prev[messageId], isPlaying: false }
            }));
            return;
          } else {
            console.log('[Voice] Resuming playback');
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
          .select('media_path, content, nonce, sender_id')
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
        console.log('[Download] Setting downloading message ID:', messageId);
        setDownloadingMessageId(messageId);

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

        console.log('[Download] Clearing downloading state');
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

      console.log('[Voice] Playing audio from:', audioUri);
      
      // Verify the file exists
      try {
        const fileInfo = await FileSystem.getInfoAsync(audioUri);
        console.log('[Voice] File info:', fileInfo);
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
          console.log('[Voice] Trying alternative loading method...');
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
        console.log('[Voice] Marking voice message as played for ephemeral handling');
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
              console.log('[Voice] Android playback not started, starting now...');
              newSound.playAsync().catch(err => console.error('[Voice] Error starting playback:', err));
            }
            
            setPlaybackStatus(prev => ({
              ...prev,
              [messageId]: { isPlaying, progress, duration }
            }));

            if ('didJustFinish' in status && status.didJustFinish) {
              newSound.unloadAsync().catch(err => console.log('[Voice] Error unloading:', err));
              setSound(null);
              setPlayingMessageId(null);
              setPlaybackStatus(prev => ({
                ...prev,
                [messageId]: { isPlaying: false, progress: 0, duration: duration }
              }));
              
              // Handle ephemeral voice message expiry after playback completion
              const message = messages.find(m => m.id === messageId);
              if (message && (message.expiryRule?.type === 'view' || message.expiryRule?.type === 'playback') && !message.isMine) {
                // Schedule expiry based on actual audio duration + 2 second buffer
                const audioDurationMs = duration || 0;
                const bufferTime = 2000; // 2 seconds buffer
                
                setTimeout(() => {
                  setMessages(prev => prev.filter(msg => msg.id !== messageId));
                }, bufferTime); // Give 2 second buffer after playback completes
              }
            }
          } else if ('error' in status) {
            console.error('[Voice] Playback error:', status.error);
            setPlayingMessageId(null);
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
      setPlayingMessageId(null);
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
          .select('media_path, content, nonce, sender_id')
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
        console.log('[Video] Starting download with params:', {
          videoId: msgData.media_path,
          hasEncryptedKey: !!msgData.content,
          hasNonce: !!msgData.nonce,
          senderId: msgData.sender_id,
          recipientId: user?.id
        });
        
        const decryptedUri = await SecureE2EVideoStorageFastAndroid.downloadAndDecryptVideo(
          msgData.media_path, // This is now the videoId
          msgData.content,    // encrypted key
          msgData.nonce,      // key nonce
          msgData.sender_id,  // sender is always the person who sent the message
          user?.id || '',     // recipient is always the current user when downloading
          (progress) => {
            // Could update UI with download progress here if needed
            console.log(`[Video] Download progress: ${Math.round(progress * 100)}%`);
          },
          msgData.video_nonce // Pass the video-specific nonce if available
        );

        setDownloadingMessageId(null);

        if (!decryptedUri) {
          throw new Error('Failed to decrypt video message');
        }

        videoUri = decryptedUri;
      }

      console.log('[Video] Playing video from:', videoUri);
      
      // Verify the file exists before playing
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      console.log('[Video] File info:', {
        exists: fileInfo.exists,
        size: fileInfo.size ? `${(fileInfo.size / 1024 / 1024).toFixed(2)}MB` : 'unknown',
        uri: fileInfo.uri,
        isDirectory: fileInfo.isDirectory
      });
      
      if (!fileInfo.exists) {
        console.error('[Video] File does not exist!');
        Alert.alert('Error', 'Video file not found');
        return;
      }
      
      // Handle ephemeral message viewing before opening player
      const msgForEphemeral = messages.find(m => m.id === messageId);
      if (msgForEphemeral) {
        console.log('[Video] Marking video message as viewed for ephemeral handling');
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
      setCurrentVideoUri(videoUri);
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
            // For view-once messages, mark as viewed in database
            // The real-time subscription will handle status updates automatically
            if (item.expiryRule?.type === 'view' && !item.isMine && item.status !== 'read') {
              // Mark as viewed in database - status will be updated via real-time subscription
              try {
                await EphemeralMessageService.markMessageViewed(item.id);
              } catch (error) {
                console.error('[FriendChat] Failed to mark message as viewed:', error);
              }
              
              // For view-once messages, schedule expiry after a short delay
              setTimeout(() => {
                setMessages(prev => prev.filter(msg => msg.id !== item.id));
              }, 5000); // 5 second viewing time
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.colors.background.secondary, borderBottomColor: theme.colors.border.default }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          
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
            <EphemeralHeaderToggle
              currentRule={currentExpiryRule}
              onPress={() => {
                // Single tap opens expiry selector
                console.log('[FriendChat] Ephemeral header toggle pressed, opening selector');
                const msgType = inputText.trim() ? 'text' : 'voice';
                console.log('[FriendChat] Setting message type:', msgType);
                setMessageTypeForExpiry(msgType);
                setShowExpirySelector(true);
                console.log('[FriendChat] Set showExpirySelector to true');
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
                <TouchableOpacity onPress={sendTextMessage} style={styles.sendButton}>
                  <Ionicons name="send" size={24} color={theme.colors.text.accent} />
                </TouchableOpacity>
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
          onClose={() => {
            setShowVideoPlayer(false);
            setCurrentVideoUri(null);
          }}
        />
      )}
      
      {/* Expiry Rule Selector */}
      <ExpiryRuleSelector
        visible={showExpirySelector}
        onClose={() => {
          console.log('[FriendChat] Modal onClose called');
          setShowExpirySelector(false);
        }}
        onSelect={async (rule) => {
          console.log('[FriendChat] Modal onSelect called with rule:', rule);
          await updatePrivacyRule(rule);
          setShowExpirySelector(false);
        }}
        messageType={messageTypeForExpiry}
        currentRule={currentExpiryRule}
      />
      
    </SafeAreaView>
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
});