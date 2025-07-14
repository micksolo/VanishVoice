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
      console.error('Error initializing chat:', error);
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

      // Convert to our message format
      const convertedMessages: Message[] = (data || []).map(msg => ({
        id: msg.id,
        type: msg.type || 'voice', // Use the type from database
        content: msg.type === 'text' ? msg.content : (msg.media_path || ''),
        isMine: msg.sender_id === user?.id,
        timestamp: new Date(msg.created_at),
        status: 'sent'
      }));

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
        
        // Convert new messages
        const convertedMessages: Message[] = (data || []).map(msg => ({
          id: msg.id,
          type: msg.type || 'voice',
          content: msg.type === 'text' ? msg.content : (msg.media_path || ''),
          isMine: msg.sender_id === user?.id,
          timestamp: new Date(msg.created_at),
          status: 'sent'
        }));

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
            // Message from friend - add to our list
            const newMessage: Message = {
              id: payload.new.id,
              type: payload.new.type || 'voice',
              content: payload.new.type === 'text' 
                ? payload.new.content 
                : (payload.new.media_path || ''),
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

      // Send to database
      const { data: sentMessage, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: friendId,
          type: 'text',
          content: messageText,
          is_encrypted: false, // TODO: Add encryption for friend messages
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

      // TODO: Upload and encrypt voice message
      // For now, just add a placeholder
      const voiceMessage: Message = {
        id: Date.now().toString(),
        type: 'voice',
        content: uri, // Local URI for now
        isMine: true,
        timestamp: new Date(),
        status: 'sending'
      };

      setMessages(prev => [...prev, voiceMessage]);
      flatListRef.current?.scrollToEnd();

      console.log('[FriendChat] Would upload voice message:', uri);

    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Error', 'Failed to send voice message');
    }
  };

  const playVoiceMessage = async (uri: string) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      setSound(newSound);

      // Unload when finished
      newSound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          newSound.unloadAsync();
          setSound(null);
        }
      });
    } catch (error) {
      console.error('Error playing voice message:', error);
      Alert.alert('Error', 'Failed to play voice message');
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
        onPress={isVoice ? () => playVoiceMessage(item.content) : undefined}
        disabled={!isVoice}
      >
        {isVoice ? (
          <View style={styles.voiceMessage}>
            <Ionicons name="mic" size={20} color={item.isMine ? '#fff' : '#000'} />
            <Text style={[styles.messageText, item.isMine && styles.myMessageText]}>
              Voice message
            </Text>
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