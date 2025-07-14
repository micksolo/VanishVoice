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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { sendMessageNotification } from '../services/pushNotifications';
import FriendEncryption from '../utils/friendEncryption';
import { uploadEncryptedAudio, downloadAndDecryptAudio } from '../utils/encryptedAudioStorage';

interface Message {
  id: string;
  type: 'text' | 'voice';
  content: string;
  isMine: boolean;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export default function FriendChatScreen({ route, navigation }: any) {
  const { friendId, friendName, friendUsername } = route.params;
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const messagePollingInterval = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const lastMessageCount = useRef<number>(0);

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
        sound.unloadAsync();
      }
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [sound, recording]);

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

  const loadMessages = async () => {
    try {
      console.log('[FriendChat] Loading messages between user and friend:', user?.id, friendId);
      
      // Load messages from the database
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${user?.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[FriendChat] Error loading messages:', error);
        return;
      }

      console.log('[FriendChat] Loaded messages:', data?.length || 0);

      // Mark all messages from friend as read
      if (data && data.length > 0) {
        const unreadMessageIds = data
          .filter(msg => msg.sender_id === friendId && !msg.read_at)
          .map(msg => msg.id);

        if (unreadMessageIds.length > 0) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .in('id', unreadMessageIds);

          if (updateError) {
            console.error('[FriendChat] Error marking messages as read:', updateError);
          }
        }
      }

      // Convert to our message format and decrypt if needed
      const convertedMessages: Message[] = [];
      
      for (const msg of (data || [])) {
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
        } else {
          // Voice message - media path
          content = msg.media_path || '';
        }
        
        convertedMessages.push({
          id: msg.id,
          type: msg.type || 'voice',
          content,
          isMine: msg.sender_id === user?.id,
          timestamp: new Date(msg.created_at),
          status: 'sent'
        });
      }

      setMessages(convertedMessages);
      lastMessageCount.current = convertedMessages.length;
    } catch (error) {
      console.error('[FriendChat] Error in loadMessages:', error);
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
          } else {
            content = msg.media_path || '';
          }
          
          convertedMessages.push({
            id: msg.id,
            type: msg.type || 'voice',
            content,
            isMine: msg.sender_id === user?.id,
            timestamp: new Date(msg.created_at),
            status: 'sent'
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
            } else {
              content = payload.new.media_path || '';
            }
            
            const newMessage: Message = {
              id: payload.new.id,
              type: payload.new.type || 'voice',
              content,
              isMine: false,
              timestamp: new Date(payload.new.created_at),
              status: 'delivered'
            };
            
            setMessages(prev => [...prev, newMessage]);
            flatListRef.current?.scrollToEnd();
          }
        }
      )
      .subscribe((status) => {
        console.log('[FriendChat] Subscription status:', status);
      });

    return () => {
      subscription.unsubscribe();
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
        status: 'sending'
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
          expiry_rule: { type: 'none' }
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

    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone access');
        return;
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Update duration
      recordingInterval.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording || !user) return;

    try {
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }

      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) return;

      // Add optimistic message
      const tempId = Date.now().toString();
      const voiceMessage: Message = {
        id: tempId,
        type: 'voice',
        content: uri, // Local URI temporarily
        isMine: true,
        timestamp: new Date(),
        status: 'sending'
      };

      setMessages(prev => [...prev, voiceMessage]);
      flatListRef.current?.scrollToEnd();

      // Upload and encrypt voice message
      const uploadResult = await uploadEncryptedAudio(uri, user.id);
      
      if (!uploadResult) {
        // Update message status to failed
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
        Alert.alert('Error', 'Failed to upload voice message');
        return;
      }

      // Send to database with encryption info
      const { data: sentMessage, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: friendId,
          type: 'voice',
          media_path: uploadResult.path,
          encryption_key: uploadResult.encryptionKey,
          encryption_iv: uploadResult.iv,
          is_encrypted: true,
          expiry_rule: { type: 'none' }
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
        Alert.alert('Error', 'Failed to send voice message');
        return;
      }

      // Update message with real ID and sent status
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { 
                ...msg, 
                id: sentMessage.id,
                content: uploadResult.path, // Update to server path
                status: 'sent' as const 
              }
            : msg
        )
      );

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

    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Error', 'Failed to send voice message');
    }
  };

  const playVoiceMessage = async (messageId: string) => {
    try {
      setPlayingMessageId(messageId);
      
      if (sound) {
        await sound.unloadAsync();
      }

      // Find the message to get encryption info
      const message = messages.find(m => m.id === messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      let audioUri: string;

      // Check if this is a local URI (for messages just sent)
      if (message.content.startsWith('file://')) {
        audioUri = message.content;
      } else {
        // This is a server path, need to download and decrypt
        // Get the message details from database to get encryption info
        const { data: msgData, error } = await supabase
          .from('messages')
          .select('media_path, encryption_key, encryption_iv')
          .eq('id', messageId)
          .single();

        if (error || !msgData) {
          throw new Error('Failed to get message details');
        }

        if (!msgData.encryption_key || !msgData.encryption_iv) {
          throw new Error('Missing encryption info');
        }

        // Download and decrypt the audio
        const decryptedUri = await downloadAndDecryptAudio(
          msgData.media_path,
          msgData.encryption_key,
          msgData.encryption_iv
        );

        if (!decryptedUri) {
          throw new Error('Failed to decrypt voice message');
        }

        audioUri = decryptedUri;
      }

      // Play the audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      setSound(newSound);

      // Unload when finished
      newSound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          newSound.unloadAsync();
          setSound(null);
          setPlayingMessageId(null);
        }
      });
    } catch (error) {
      console.error('Error playing voice message:', error);
      Alert.alert('Error', 'Failed to play voice message');
      setPlayingMessageId(null);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isVoice = item.type === 'voice';

    return (
      <TouchableOpacity
        style={[
          styles.messageBubble,
          item.isMine ? styles.myMessage : styles.theirMessage,
        ]}
        onPress={isVoice ? () => playVoiceMessage(item.id) : undefined}
        disabled={!isVoice}
      >
        {isVoice ? (
          <View style={styles.voiceMessage}>
            {playingMessageId === item.id ? (
              <ActivityIndicator size="small" color={item.isMine ? '#fff' : '#4ECDC4'} />
            ) : (
              <Ionicons name="mic" size={20} color={item.isMine ? '#fff' : '#000'} />
            )}
            <Text style={[styles.messageText, item.isMine && styles.myMessageText]}>
              Voice message
            </Text>
            {item.status === 'sending' && (
              <ActivityIndicator size="small" color={item.isMine ? '#fff' : '#666'} style={{ marginLeft: 8 }} />
            )}
          </View>
        ) : (
          <Text style={[styles.messageText, item.isMine && styles.myMessageText]}>
            {item.content}
          </Text>
        )}
        
        {item.status === 'sending' && (
          <ActivityIndicator size="small" color={item.isMine ? '#fff' : '#666'} style={styles.statusIndicator} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </SafeAreaView>
    );
  }

  return (
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
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
            <TouchableOpacity
              onPressIn={startRecording}
              onPressOut={stopRecording}
              style={[styles.micButton, isRecording && styles.micButtonRecording]}
            >
              <Ionicons name="mic" size={24} color={isRecording ? '#fff' : '#4ECDC4'} />
              {isRecording && (
                <Text style={styles.recordingDuration}>{recordingDuration}s</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusIndicator: {
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
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
  micButton: {
    marginLeft: 8,
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  micButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  recordingDuration: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
    fontSize: 12,
    color: '#FF3B30',
  },
});