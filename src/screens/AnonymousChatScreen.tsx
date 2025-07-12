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
import matchingEngine from '../services/matching';
import { useAnonymousSession } from '../hooks/useAnonymousSession';
import AnonymousEncryption from '../utils/anonymousEncryption';
import AnonymousAudioStorage from '../utils/anonymousAudioStorage';

interface Message {
  id: string;
  type: 'text' | 'voice' | 'video';
  content: string;
  isMine: boolean;
  timestamp: Date;
}

export default function AnonymousChatScreen({ route, navigation }: any) {
  const { conversationId, partnerId } = route.params;
  const { session, deviceHash } = useAnonymousSession();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [encryption, setEncryption] = useState<AnonymousEncryption | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const encryptionRef = useRef<AnonymousEncryption | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    if (session) {
      initializeChat().then((cleanupFn) => {
        cleanup = cleanupFn;
      });
    }
    
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [session]);

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
      console.log('[AnonymousChat] Initializing chat...');
      console.log('Session:', session);
      console.log('Partner ID:', partnerId);
      console.log('Conversation ID:', conversationId);
      
      if (!session) {
        throw new Error('No session available');
      }

      // Initialize encryption first and wait for it to complete
      const enc = new AnonymousEncryption();
      console.log('[AnonymousChat] Starting encryption initialization...');
      await enc.initialize(session, partnerId);
      console.log('[AnonymousChat] Encryption initialized successfully');
      
      // Store in both state and ref
      setEncryption(enc);
      encryptionRef.current = enc;

      // Now load initial messages with encryption ready
      await loadMessages(enc);
      
      // Small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Then subscribe to new messages
      const unsubscribe = subscribeToMessages();
      
      setLoading(false);
      
      // Return cleanup function
      return () => {
        unsubscribe();
        if (enc) {
          enc.cleanup();
        }
        encryptionRef.current = null;
      };
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'Failed to initialize chat');
    }
  };

  const subscribeToMessages = () => {
    console.log('[AnonymousChat] Setting up message subscription for conversation:', conversationId);
    
    const subscription = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'anonymous_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          console.log('[AnonymousChat] New message received:', payload);
          
          if (payload.new.sender_session !== session?.sessionId) {
            // Decrypt and add message from partner using ref
            const decrypted = await decryptMessage(payload.new, encryptionRef.current);
            if (decrypted) {
              setMessages((prev) => [...prev, decrypted]);
              flatListRef.current?.scrollToEnd();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[AnonymousChat] Subscription status:', status);
      });

    return () => {
      subscription.unsubscribe();
    };
  };

  const loadMessages = async (encryptionInstance?: AnonymousEncryption) => {
    try {
      console.log('[AnonymousChat] Loading messages for conversation:', conversationId);
      
      const { data, error } = await supabase
        .from('anonymous_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[AnonymousChat] Error loading messages:', error);
        throw error;
      }

      console.log('[AnonymousChat] Loaded messages:', data?.length || 0);

      if (data && data.length > 0) {
        const decryptedMessages = await Promise.all(
          data.map(async (msg) => decryptMessage(msg, encryptionInstance))
        );

        setMessages(decryptedMessages.filter(Boolean) as Message[]);
      }
    } catch (error) {
      console.error('[AnonymousChat] Error in loadMessages:', error);
    }
  };

  const decryptMessage = async (encryptedMsg: any, encryptionInstance?: AnonymousEncryption): Promise<Message | null> => {
    const enc = encryptionInstance || encryption || encryptionRef.current;
    if (!enc) {
      console.error('[AnonymousChat] Cannot decrypt - encryption not initialized, waiting for encryption...');
      
      // Wait a bit and try again with the ref
      await new Promise(resolve => setTimeout(resolve, 100));
      const retryEnc = encryptionRef.current;
      if (!retryEnc) {
        console.error('[AnonymousChat] Encryption still not available after retry');
        return null;
      }
      
      console.log('[AnonymousChat] Retrying decryption with encryption ref');
      return decryptMessage(encryptedMsg, retryEnc);
    }

    try {
      console.log('[AnonymousChat] Decrypting message:', encryptedMsg.id);
      
      const decrypted = await enc.decryptMessage(
        encryptedMsg.encrypted_content,
        encryptedMsg.nonce
      );

      let content = decrypted;
      
      // For voice messages, the content is the local URI after download
      if (encryptedMsg.message_type === 'voice') {
        // Download and decrypt audio
        const audioUri = await AnonymousAudioStorage.downloadAndDecrypt(
          decrypted, // This is the storage path
          enc,
          encryptedMsg.nonce // Pass the nonce
        );
        content = audioUri || '';
      }

      return {
        id: encryptedMsg.id,
        type: encryptedMsg.message_type,
        content,
        isMine: encryptedMsg.sender_session === session?.sessionId,
        timestamp: new Date(encryptedMsg.created_at),
      };
    } catch (error) {
      console.error('Error decrypting message:', error);
      return null;
    }
  };

  const sendTextMessage = async () => {
    if (!inputText.trim() || !encryption || !session) return;

    try {
      const messageText = inputText.trim();
      setInputText('');

      // Encrypt message
      const { ciphertext, nonce } = await encryption.encryptMessage(messageText);

      // Send to database
      const { data, error } = await supabase
        .from('anonymous_messages')
        .insert({
          conversation_id: conversationId,
          sender_session: session.sessionId,
          message_type: 'text',
          encrypted_content: ciphertext,
          nonce,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local messages
      setMessages((prev) => [
        ...prev,
        {
          id: data.id,
          type: 'text',
          content: messageText,
          isMine: true,
          timestamp: new Date(),
        },
      ]);

      flatListRef.current?.scrollToEnd();
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
    if (!recording || !encryption || !session) return;

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

      // Upload and encrypt
      const uploadResult = await AnonymousAudioStorage.uploadAndEncrypt(
        uri,
        encryption
      );

      if (!uploadResult) {
        throw new Error('Failed to upload audio');
      }

      // Send message with storage path
      const { data, error } = await supabase
        .from('anonymous_messages')
        .insert({
          conversation_id: conversationId,
          sender_session: session.sessionId,
          message_type: 'voice',
          encrypted_content: uploadResult.ciphertext,
          nonce: uploadResult.nonce,
          encrypted_metadata: {
            duration: recordingDuration,
          },
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local messages
      setMessages((prev) => [
        ...prev,
        {
          id: data.id,
          type: 'voice',
          content: uri, // Local URI for playback
          isMine: true,
          timestamp: new Date(),
        },
      ]);

      flatListRef.current?.scrollToEnd();
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

  const skipPerson = async () => {
    Alert.alert(
      'Skip this person?',
      'You will be matched with someone new',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            try {
              const hash = await deviceHash();
              await matchingEngine.skipCurrentMatch(
                conversationId,
                session!.sessionId,
                hash
              );
              navigation.replace('AnonymousLobby');
            } catch (error) {
              console.error('Error skipping:', error);
            }
          },
        },
      ]
    );
  };

  const reportUser = () => {
    Alert.alert(
      'Report User',
      'Why are you reporting this person?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Inappropriate', onPress: () => handleReport('inappropriate') },
        { text: 'Spam', onPress: () => handleReport('spam') },
        { text: 'Underage', onPress: () => handleReport('underage') },
        { text: 'Harassment', onPress: () => handleReport('harassment') },
      ]
    );
  };

  const handleReport = async (reason: string) => {
    try {
      const hash = await deviceHash();
      await matchingEngine.reportUser(
        conversationId,
        session!.sessionId,
        hash,
        partnerId,
        reason as any
      );
      navigation.replace('AnonymousLobby');
    } catch (error) {
      console.error('Error reporting:', error);
      Alert.alert('Error', 'Failed to report user');
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
            <Text style={styles.headerTitle}>Anonymous</Text>
            <Text style={styles.headerSubtitle}>🔒 E2E Encrypted</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => loadMessages()} style={styles.headerButton}>
              <Ionicons name="refresh" size={24} color="#4ECDC4" />
            </TouchableOpacity>
            <TouchableOpacity onPress={skipPerson} style={styles.headerButton}>
              <Ionicons name="arrow-forward" size={24} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity onPress={reportUser} style={styles.headerButton}>
              <Ionicons name="flag" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
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
  },
  myMessageText: {
    color: '#fff',
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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