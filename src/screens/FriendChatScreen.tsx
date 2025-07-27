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
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
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
import { ExpiryRule } from '../types/database';
import RecordingModal from '../components/RecordingModal';
import VideoRecordingModal from '../components/VideoRecordingModalNew';
import VideoPlayerModal from '../components/VideoPlayerModal';
import EphemeralIndicator from '../components/EphemeralIndicator';
import ExpiryButton from '../components/ExpiryButton';
import ExpiryRuleSelector from '../components/ExpiryRuleSelector';
import MessageBubble from '../components/MessageBubble';
import VoiceMessagePlayer from '../components/VoiceMessagePlayer';
import * as FileSystem from 'expo-file-system';
import { Video, ResizeMode } from 'expo-av';

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
}

const PAGE_SIZE = 20;

export default function FriendChatScreen({ route, navigation }: any) {
  const { friendId, friendName, friendUsername } = route.params;
  const { user } = useAuth();
  
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
  const [showExpirySelector, setShowExpirySelector] = useState(false);
  const [currentExpiryRule, setCurrentExpiryRule] = useState<ExpiryRule>({ type: 'none' });
  const [messageTypeForExpiry, setMessageTypeForExpiry] = useState<'text' | 'voice' | 'video'>('text');
  
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const messagePollingInterval = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const lastMessageCount = useRef<number>(0);
  const isRecordingRef = useRef<boolean>(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    if (user && friendId) {
      initializeChat().then((cleanupFn) => {
        cleanup = cleanupFn;
      });
    }
    
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [user, friendId]);

  useEffect(() => {
    // Cleanup audio on unmount
    return () => {
      if (sound) {
        sound.unloadAsync().catch(err => console.log('Error unloading sound:', err));
      }
    };
  }, [sound]);

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
      
      setLoading(false);
      
      return () => {
        unsubscribe();
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
      const convertedMessages: Message[] = [];
      
      for (const msg of (reversedData || [])) {
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
        
        convertedMessages.push({
          id: msg.id,
          type: msg.type || 'voice',
          content,
          isMine: msg.sender_id === user?.id,
          timestamp: new Date(msg.created_at),
          status: 'sent',
          duration: msg.duration
        });
      }

      if (loadMore) {
        // Prepend older messages
        setMessages(prev => [...convertedMessages, ...prev]);
        setMessageOffset(messageOffset + data.length);
      } else {
        // Initial load
        setMessages(convertedMessages);
        setMessageOffset(data ? data.length : 0);
      }
      
      lastMessageCount.current = convertedMessages.length;
    } catch (error) {
      console.error('[FriendChat] Error in loadMessages:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
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

      const currentCount = data?.length || 0;
      
      if (currentCount > lastMessageCount.current) {
        console.log('[FriendChat] New messages detected via polling!');
        
        // Convert and decrypt new messages
        const convertedMessages: Message[] = [];
        
        for (const msg of (data || [])) {
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
            status: 'sent',
            duration: msg.duration
          });
        }

        setMessages(convertedMessages);
        lastMessageCount.current = currentCount;
        flatListRef.current?.scrollToEnd();
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
              status: 'delivered',
              duration: payload.new.duration
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

    return () => {
      subscription.unsubscribe();
      expirySubscription.unsubscribe();
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

      // Update message with real ID and sent status
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMessage.id 
            ? { 
                ...msg, 
                id: sentMessage.id,
                status: 'sent' as const 
              }
            : msg
        )
      );
      
      // Reset expiry rule after successful send
      setCurrentExpiryRule({ type: 'none' });

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

      // Animate mic button
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
      
      // Reset expiry rule after successful send
      setCurrentExpiryRule({ type: 'none' });
        
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
      
      // Reset expiry rule after successful send
      setCurrentExpiryRule({ type: 'none' });
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
        expiryRule: currentExpiryRule
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
          expiry_rule: currentExpiryRule,
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
      
      // Reset expiry rule after successful send
      setCurrentExpiryRule({ type: 'none' });
        Alert.alert('Error', 'Failed to send voice message');
        return;
      }

      // Update message with real ID
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { 
                ...msg, 
                id: sentMessage.id,
                status: 'sent' as const 
              }
            : msg
        )
      );
      setUploadingMessageId(null);
      
      // Reset expiry rule after successful send
      setCurrentExpiryRule({ type: 'none' });

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
      
      // Reset expiry rule after successful send
      setCurrentExpiryRule({ type: 'none' });
        Alert.alert('Error', 'Failed to send video message');
        return;
      }

      // Update message with real ID
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { 
                ...msg, 
                id: sentMessage.id,
                status: 'sent' as const 
              }
            : msg
        )
      );
      setUploadingMessageId(null);
      
      // Reset expiry rule after successful send
      setCurrentExpiryRule({ type: 'none' });

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
      
      // Reset expiry rule after successful send
      setCurrentExpiryRule({ type: 'none' });
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
      
      // Reset expiry rule after successful send
      setCurrentExpiryRule({ type: 'none' });
      
      // Generic error message - don't expose technical details
      Alert.alert('Error', 'Failed to send video message. Please try again.');
    }
  };

  const playVoiceMessage = async (messageId: string) => {
    try {
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

      // Find the message to get encryption info
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        throw new Error('Message not found');
      }

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
      // Set downloading state
      setDownloadingMessageId(messageId);

      // Find the message to get encryption info
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        throw new Error('Message not found');
      }

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
      // Use MessageBubble for text messages
      return (
        <MessageBubble
          content={item.content}
          isMine={item.isMine}
          timestamp={item.timestamp}
          expiryRule={item.expiryRule}
          isEphemeral={!!item.expiryRule && item.expiryRule.type !== 'none'}
          hasBeenViewed={item.status === 'read'}
          isExpired={false} // TODO: Add proper expiry logic
          messageType={item.type}
          senderName={item.isMine ? undefined : (friendName || friendUsername)}
        />
      );
    } else if (item.type === 'voice') {
      // Use custom voice message rendering
      return (
        <View
          style={[
            styles.messageBubble,
            styles.voiceMessageBubble,
            item.isMine ? styles.myMessage : styles.theirMessage,
          ]}
        >
          <View style={styles.voiceMessage}>
            <View style={styles.voiceMessageLeft}>
              <TouchableOpacity 
                style={[
                  styles.playButton,
                  item.isMine ? styles.playButtonMine : styles.playButtonTheirs
                ]}
                onPress={() => playVoiceMessage(item.id)}
                disabled={isUploading || isDownloading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : isDownloading ? (
                  downloadProgress[item.id] !== undefined ? (
                    <Text style={[
                      styles.progressText,
                      { color: item.isMine ? "#fff" : "#4ECDC4" }
                    ]}>
                      {downloadProgress[item.id]}%
                    </Text>
                  ) : (
                    <ActivityIndicator size="small" color={item.isMine ? "#fff" : "#4ECDC4"} />
                  )
                ) : (
                  <Ionicons 
                    name={isCurrentlyPlaying ? "pause" : "play"} 
                    size={16} 
                    color={item.isMine ? "#fff" : "#4ECDC4"} 
                  />
                )}
              </TouchableOpacity>
              
              <View style={styles.voiceMessageContent}>
                <View style={styles.waveformContainer}>
                  {[...Array(8)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.waveformBar,
                        {
                          height: Math.random() * 15 + 5,
                          backgroundColor: item.isMine ? 'rgba(255,255,255,0.7)' : '#4ECDC4',
                        }
                      ]}
                    />
                  ))}
                </View>
                
                <Text style={[
                  styles.voiceDuration,
                  item.isMine ? styles.voiceDurationMine : styles.voiceDurationTheirs
                ]}>
                  {status ? formatDuration(status.progress) : `${item.duration || 0}s`}
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    } else if (item.type === 'video') {
      // Use custom video message rendering
      return (
        <View
          style={[
            styles.messageBubble,
            styles.videoMessage,
            item.isMine ? styles.myMessage : styles.theirMessage,
          ]}
        >
          <TouchableOpacity 
            style={styles.videoThumbnailContainer}
            onPress={() => playVideoMessage(item.id)}
            disabled={isUploading || isDownloading}
          >
            {isUploading || isDownloading ? (
              <View style={styles.videoUploadingContainer}>
                <ActivityIndicator size="large" color={item.isMine ? "#fff" : "#4ECDC4"} />
                <Text style={[
                  styles.uploadingText,
                  item.isMine && styles.uploadingTextMine
                ]}>
                  {isUploading ? 'Uploading...' : 'Loading...'}
                </Text>
              </View>
            ) : (
              <View style={styles.videoPlaceholder}>
                <View style={styles.playOverlay}>
                  <View style={styles.playCircle}>
                    <Ionicons name="play" size={24} color="white" />
                  </View>
                </View>
                <View style={styles.videoDurationContainer}>
                  <Text style={[
                    styles.videoDuration,
                    item.isMine && styles.videoDurationMine
                  ]}>
                    {item.duration || 30}s
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{friendName}</Text>
            {friendUsername && (
              <Text style={styles.headerSubtitle}>@{friendUsername}</Text>
            )}
          </View>

          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="information-circle-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => {
            if (!loadingMore) {
              flatListRef.current?.scrollToEnd();
            }
          }}
          onEndReachedThreshold={0.1}
          ListHeaderComponent={
            hasMoreMessages ? (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() => loadMessages(true)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#4ECDC4" />
                ) : (
                  <Text style={styles.loadMoreText}>Load earlier messages</Text>
                )}
              </TouchableOpacity>
            ) : messages.length > 0 ? (
              <View style={styles.noMoreMessages}>
                <Text style={styles.noMoreText}>Beginning of conversation</Text>
              </View>
            ) : null
          }
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          {!isRecording ? (
            <>
              <ExpiryButton 
                onPress={() => {
                  setMessageTypeForExpiry(inputText.trim() ? 'text' : 'voice');
                  setShowExpirySelector(true);
                }}
                currentRule={currentExpiryRule}
              />
              
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                multiline
                maxLength={500}
              />
              
              {inputText.trim() ? (
                <TouchableOpacity onPress={sendTextMessage} style={styles.sendButton}>
                  <Ionicons name="send" size={24} color="#4ECDC4" />
                </TouchableOpacity>
              ) : (
                <View style={styles.mediaButtons}>
                  <TouchableOpacity
                    onPress={() => {
                      setMessageTypeForExpiry('video');
                      setShowVideoModal(true);
                    }}
                    style={styles.videoButton}
                  >
                    <Ionicons name="videocam" size={24} color="#4ECDC4" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setMessageTypeForExpiry('voice');
                      startRecording();
                    }}
                    style={styles.micButton}
                  >
                    <Ionicons name="mic" size={24} color="#4ECDC4" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={styles.recordingContainer}>
              {/* Cancel button */}
              <TouchableOpacity
                onPress={cancelRecording}
                style={styles.cancelRecordingButton}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>

              {/* Recording info */}
              <View style={styles.recordingInfo}>
                <View style={styles.recordingHeader}>
                  <Animated.View 
                    style={[
                      styles.recordingDot,
                      {
                        opacity: recordingDuration % 2 ? 1 : 0.3,
                      }
                    ]} 
                  />
                  <Text style={styles.recordingTime}>
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
                
                {/* Waveform visualization */}
                <View style={styles.waveformContainer}>
                  {[...Array(15)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.waveformBar,
                        {
                          height: Math.random() * 15 + 10,
                          opacity: recordingDuration > 0 ? 0.8 : 0.3,
                        }
                      ]}
                    />
                  ))}
                </View>
                
                <Text style={styles.recordingHint}>Tap send when ready</Text>
              </View>

              {/* Send button */}
              <TouchableOpacity
                onPress={stopRecording}
                style={styles.sendVoiceButton}
                activeOpacity={0.8}
              >
                <Animated.View
                  style={{
                    transform: [{ scale: micScale }]
                  }}
                >
                  <Ionicons name="send" size={24} color="#fff" />
                </Animated.View>
              </TouchableOpacity>
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
        onClose={() => setShowExpirySelector(false)}
        onSelect={(rule) => {
          setCurrentExpiryRule(rule);
          setShowExpirySelector(false);
        }}
        messageType={messageTypeForExpiry}
      />
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
    backgroundColor: '#4ECDC4',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0E0E0',
  },
  messageText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  myMessageText: {
    color: '#fff',
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
    backgroundColor: '#000',
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
    color: '#666',
  },
  uploadingTextMine: {
    color: 'rgba(255, 255, 255, 0.8)',
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
    backgroundColor: '#4ECDC4',
  },
  voiceDuration: {
    fontSize: 12,
    opacity: 0.8,
  },
  voiceDurationMine: {
    color: '#fff',
  },
  voiceDurationTheirs: {
    color: '#666',
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
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    minHeight: 68,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    fontSize: 16,
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
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  micButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  micButtonPressed: {
    backgroundColor: '#4ECDC4',
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
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
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
    backgroundColor: '#FF3B30',
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    minWidth: 45,
  },
  recordingHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  slideToCancel: {
    fontSize: 14,
    color: '#999',
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
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  cancelRecordingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3F3',
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
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginVertical: 10,
    alignSelf: 'center',
  },
  loadMoreText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
  },
  noMoreMessages: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noMoreText: {
    color: '#999',
    fontSize: 14,
  },
});