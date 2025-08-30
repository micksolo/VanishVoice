import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Animated,
  AppState,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme';
import { supabase } from '../services/supabase';
import RecordingModal from '../components/RecordingModal';
import { useFocusEffect } from '@react-navigation/native';
import { downloadAudio } from '../utils/audioStorage';
import { downloadAndDecryptAudio } from '../utils/encryptedAudioStorage';
import { downloadAndDecryptE2EAudio } from '../utils/e2eAudioStorage';
import { downloadAndDecryptAudioCompat } from '../utils/secureE2EAudioStorage';
import { downloadAndDecryptAudioUniversal } from '../utils/audioDecryptionCompat';
import VanishAnimation from '../components/VanishAnimation';
import { EphemeralMessageService } from '../services/ephemeralMessages';
import { Message as DBMessage } from '../types/database';
import messageClearingService from '../services/messageClearingService';

interface Message {
  id: string;
  sender_id: string;
  created_at: string;
  media_path: string;
  encryption_iv?: string;
  encrypted_key?: string;
  sender_public_key?: string;
  auth_tag?: string;
  encryption_version?: number;
  sender?: {
    friend_code: string;
    avatar_seed: string;
    username?: string;
  };
}

interface Friend {
  id: string;
  friend_id: string;
  user_id?: string;
  nickname?: string;
  friend?: {
    friend_code: string;
    avatar_seed: string;
    username?: string;
  };
  mutual?: boolean;
}

export default function EphemeralInboxScreen({ navigation }: any) {
  const { user, userKeys } = useAuth();
  const theme = useAppTheme();
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showMessages, setShowMessages] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [recordingModalVisible, setRecordingModalVisible] = useState(false);
  const [recordingFor, setRecordingFor] = useState<{ id: string; name: string } | null>(null);
  const [playingMessage, setPlayingMessage] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const [vanishingMessages, setVanishingMessages] = useState<Set<string>>(new Set());
  const expirySubscriptionRef = useRef<any>(null);
  const deletionSubscriptionRef = useRef<any>(null);
  const clearingSubscriptionRef = useRef<any>(null);

  // Floating animation for empty state
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Reduce polling frequency to minimize state issues
      // Use real-time subscriptions instead of aggressive polling
      const pollInterval = setInterval(() => {
        fetchData();
      }, 30000); // Poll every 30 seconds instead of 5

      return () => clearInterval(pollInterval);
    }
  }, [user]);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchData();
      }
    }, [user])
  );

  // Refresh when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && user) {
        fetchData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Subscribe to message expiry and deletion
  useEffect(() => {
    if (!user) return;

    // Subscribe to message expiry updates
    expirySubscriptionRef.current = EphemeralMessageService.subscribeToMessageExpiry((messageId) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setVanishingMessages(prev => {
        const next = new Set(prev);
        next.add(messageId);
        // Remove from vanishing set after animation
        setTimeout(() => {
          setVanishingMessages(p => {
            const n = new Set(p);
            n.delete(messageId);
            return n;
          });
        }, 1000);
        return next;
      });
    });

    // Subscribe to message deletions
    deletionSubscriptionRef.current = EphemeralMessageService.subscribeToMessageDeletion(
      user.id,
      (messageId) => {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    );

    // Subscribe to message clearing events (for "Clear All Chats" functionality)
    clearingSubscriptionRef.current = messageClearingService.subscribeToMessageClearing(() => {
      console.log('[EphemeralInboxScreen] Received message clearing event, clearing local messages');
      setMessages([]);
      setNewMessageCount(0);
      setVanishingMessages(new Set());
    });

    return () => {
      if (expirySubscriptionRef.current) {
        expirySubscriptionRef.current.unsubscribe();
      }
      if (deletionSubscriptionRef.current) {
        deletionSubscriptionRef.current.unsubscribe();
      }
      if (clearingSubscriptionRef.current) {
        clearingSubscriptionRef.current();
      }
    };
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch unplayed messages count
      const { count, data: messagesData } = await supabase
        .from('messages')
        .select('*, sender:sender_id(friend_code, avatar_seed, username)', { count: 'exact' })
        .eq('recipient_id', user?.id)
        .eq('expired', false)
        .is('listened_at', null)
        .order('created_at', { ascending: false });

      const newCount = count || 0;
      const currentMessages = messagesData || [];
      
      // Only update state if the data has actually changed
      if (newCount !== newMessageCount) {
        // Show alert if new messages arrived
        if (newCount > newMessageCount && newMessageCount !== 0) {
          // Animate the message counter
          Animated.sequence([
            Animated.timing(bounceAnim, {
              toValue: 1.3,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(bounceAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
        setNewMessageCount(newCount);
      }

      // Only update messages if they've changed (compare by IDs to avoid unnecessary re-renders)
      const currentMessageIds = messages.map(m => m.id).sort().join(',');
      const newMessageIds = currentMessages.map(m => m.id).sort().join(',');
      
      if (currentMessageIds !== newMessageIds) {
        setMessages(currentMessages);
      }

      // Fetch friends for sending (both directions)
      // Get people I added as friends
      const { data: myFriends } = await supabase
        .from('friends')
        .select('*, friend:friend_id(friend_code, avatar_seed, username)')
        .eq('user_id', user?.id);

      // Get people who added me as a friend
      const { data: friendsOfMe } = await supabase
        .from('friends')
        .select('*, friend:user_id(friend_code, avatar_seed, username)')
        .eq('friend_id', user?.id);

      // Combine and deduplicate
      const allFriends = [...(myFriends || [])];
      
      // Transform friendsOfMe to match the same structure
      if (friendsOfMe) {
        friendsOfMe.forEach(fom => {
          // Check if this person is already in our friends list
          const alreadyFriend = allFriends.some(f => f.friend_id === fom.user_id);
          if (!alreadyFriend) {
            // Add them with a special flag or just add them
            allFriends.push({
              ...fom,
              friend_id: fom.user_id,
              friend: fom.friend,
              mutual: false // They added us, but we haven't added them back
            });
          }
        });
      }

      setFriends(allFriends);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const playMessage = async (message: Message) => {
    try {
      // Convert to DBMessage format for the overlay
      const dbMessage: DBMessage = {
        id: message.id,
        sender_id: message.sender_id,
        recipient_id: user?.id || '',
        type: 'voice',
        content: '',
        media_path: message.media_path,
        nonce: message.encryption_iv,
        expiry_rule: { type: 'playback' }, // Voice messages expire after playback
        created_at: message.created_at,
        viewed_at: undefined,
        listened_at: undefined,
        read_at: undefined,
        expired: false,
        is_encrypted: true,
        duration: undefined,
      };

      // Since we removed ViewingOverlay, play messages directly in chat
      console.log('Ephemeral messages now display inline - this function may no longer be needed');
    } catch (error) {
      console.error('Error preparing message:', error);
      Alert.alert('Error', 'Failed to open message. Please try again.');
    }
  };

  const vanishMessage = async (messageId: string) => {
    try {
      // The edge function will handle the actual deletion
      // Just update local state
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setNewMessageCount(prev => Math.max(0, prev - 1));
      setPlayingMessage(null);

      // If no more messages, hide the revealed list
      if (messages.length <= 1) {
        setShowMessages(false);
      }
    } catch (error) {
      console.error('Error handling message expiry:', error);
    }
  };

  const handleSendMessage = async (audioPath: string, duration: number, encryptionKey: string, iv: string, senderPublicKey?: string, authTag?: string) => {
    if (!recordingFor || !user) return;

    try {
      const expiryRule = {
        type: 'playback',
        play_count: 1,
      };

      // Determine encryption version based on what was used
      let encryptionVersion = 1; // Default legacy
      if (authTag) {
        encryptionVersion = 2; // Secure encryption with auth tag
      } else if (userKeys?.secretKey && !authTag) {
        encryptionVersion = 3; // NaCl (no auth tag, uses built-in MAC)
      }
      
      console.log('[EphemeralInbox] Saving message with:');
      console.log('- Encryption version:', encryptionVersion);
      console.log('- Encrypted key: ready');
      console.log('- IV (nonce): ready');
      console.log('- Sender public key: ready');
      
      const { data: messageData, error } = await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: recordingFor.id,
        media_path: audioPath,
        expiry_rule: expiryRule,
        encryption_iv: iv,
        encrypted_key: encryptionKey,
        sender_public_key: senderPublicKey || null,
        auth_tag: authTag || null,
        encryption_version: encryptionVersion,
      }).select().single();

      if (error) throw error;

      // Send push notification
      // Only skip if we're in Expo Go (not development builds)
      const isExpoGo = Constants.appOwnership === 'expo';
      
      if (!isExpoGo) {
        try {
          console.log('Sending push notification to:', recordingFor.id);
          console.log('Request payload:', {
            recipientId: recordingFor.id,
            senderId: user.id,
            senderName: user.username || user.friend_code,
            messageId: messageData.id,
          });
          
          const { data: notifData, error: notifError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              recipientId: recordingFor.id,
              senderId: user.id,
              senderName: user.username || user.friend_code,
              messageId: messageData.id,
            },
          });
          
          if (notifError) {
            console.error('Failed to send push notification:', notifError);
            console.error('Error details:', JSON.stringify(notifError, null, 2));
          } else {
            console.log('Push notification sent successfully:', notifData);
          }
        } catch (notifError: any) {
          console.error('Error sending push notification:', notifError);
          console.error('Caught error details:', notifError.message, notifError.status);
        }
      } else {
        console.log('Skipping push notifications in Expo Go');
      }

      Alert.alert('Sent!', `Voice message sent to ${recordingFor.name}`);
      setRecordingModalVisible(false);
      setRecordingFor(null);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const addFriend = async () => {
    if (!friendCode.trim()) {
      Alert.alert('Error', 'Please enter a friend code');
      return;
    }

    try {
      const { data: friendUser } = await supabase
        .from('users')
        .select('id')
        .eq('friend_code', friendCode.trim())
        .single();

      if (!friendUser) {
        Alert.alert('Error', 'Friend code not found');
        return;
      }

      await supabase.from('friends').insert({
        user_id: user?.id,
        friend_id: friendUser.id,
      });

      Alert.alert('Success', 'Friend added!');
      setAddFriendModalVisible(false);
      setFriendCode('');
      fetchData();
    } catch (error: any) {
      if (error.code === '23505') {
        Alert.alert('Error', 'Already friends with this user');
      } else {
        Alert.alert('Error', 'Failed to add friend');
      }
    }
  };

  const randomConnect = async () => {
    setActionModalVisible(false);
    // Navigate to anonymous chat lobby
    navigation.navigate('AnonymousLobby');
  };

  const getAvatarColor = (seed: string = '') => {
    const colors = [
      theme.colors.accent.red,
      theme.colors.accent.teal,
      theme.colors.accent.blue,
      theme.colors.accent.green,
      theme.colors.accent.orange,
      theme.colors.accent.pink
    ];
    const index = seed.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const deleteFriend = async (friendId: string) => {
    try {
      // Delete both directions of the friendship
      // 1. Delete where I added them
      const { error: error1 } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', user?.id)
        .eq('friend_id', friendId);

      // 2. Delete where they added me
      const { error: error2 } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', user?.id);

      if (!error1 || !error2) {
        Alert.alert('Success', 'Friend removed');
        fetchData();
      } else {
        throw new Error('Failed to remove friend relationship');
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      Alert.alert('Error', 'Failed to remove friend');
    }
  };

  const blockUser = async (friendId: string) => {
    // For now, just remove them. In future, add blocked_users table
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? They will be removed from your friends and won\'t be able to send you messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Block', 
          style: 'destructive',
          onPress: () => deleteFriend(friendId)
        }
      ]
    );
  };

  const renderRightActions = (friendId: string) => {
    return (
      <View style={styles.swipeActions}>
        <TouchableOpacity
          style={[styles.swipeAction, styles.blockAction]}
          onPress={() => blockUser(friendId)}
        >
          <Ionicons name="ban" size={24} color={theme.colors.text.inverse} />
          <Text style={styles.swipeActionText}>Block</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, styles.deleteAction]}
          onPress={() => deleteFriend(friendId)}
        >
          <Ionicons name="trash" size={24} color={theme.colors.text.inverse} />
          <Text style={styles.swipeActionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isVanishing = vanishingMessages.has(item.id);
    
    return (
      <VanishAnimation trigger={isVanishing} onComplete={() => {}}>
        <TouchableOpacity
          style={styles.messageItem}
          onPress={() => playMessage(item)}
          disabled={playingMessage === item.id || isVanishing}
        >
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.sender?.avatar_seed) }]}>
            <Text style={styles.avatarText}>
              {(item.sender?.username || item.sender?.friend_code || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.messageContent}>
            <Text style={styles.senderName}>From: {item.sender?.username || item.sender?.friend_code || 'Unknown'}</Text>
            <Text style={styles.messageTime}>
              {new Date(item.created_at).toLocaleTimeString()}
            </Text>
          </View>
          {playingMessage === item.id ? (
            <Ionicons name="volume-high" size={24} color={theme.colors.accent.teal} />
          ) : (
            <Ionicons name="play-circle" size={32} color={theme.colors.text.primary} />
          )}
        </TouchableOpacity>
      </VanishAnimation>
    );
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item.friend_id)}
      overshootRight={false}
    >
      <TouchableOpacity
        style={styles.friendCard}
        onPress={() => {
          setRecordingFor({
            id: item.friend_id,
            name: (item.nickname && !item.nickname.startsWith('Random:')) ? item.nickname : (item.friend?.username || item.friend?.friend_code || 'Friend'),
          });
          setRecordingModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.friendAvatar, { backgroundColor: getAvatarColor(item.friend?.avatar_seed) }]}>
          <Text style={styles.friendAvatarText}>
            {((item.nickname && !item.nickname.startsWith('Random:')) ? item.nickname : (item.friend?.username || item.friend?.friend_code || '?'))[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>
            {(item.nickname && !item.nickname.startsWith('Random:')) ? item.nickname : (item.friend?.username || 'Anonymous')}
          </Text>
          {!item.friend?.username && (
            <Text style={styles.friendCode}>
              {item.friend?.friend_code || 'Unknown'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.micButton}
          onPress={() => {
            setRecordingFor({
              id: item.friend_id,
              name: (item.nickname && !item.nickname.startsWith('Random:')) ? item.nickname : (item.friend?.username || item.friend?.friend_code || 'Friend'),
            });
            setRecordingModalVisible(true);
          }}
        >
          <Ionicons name="mic" size={24} color={theme.colors.accent.teal} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );

  const styles = getStyles(theme);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => (
          <View style={styles.content}>
          {/* Message Counter */}
          {newMessageCount > 0 && !showMessages && (
            <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
              <TouchableOpacity
                style={styles.messageCounter}
                onPress={() => setShowMessages(true)}
              >
                <View style={styles.counterDot} />
                <Text style={styles.counterText}>
                  {newMessageCount} new {newMessageCount === 1 ? 'message' : 'messages'}
                </Text>
                <Text style={styles.tapToReveal}>Tap to reveal</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Revealed Messages */}
          {showMessages && messages.length > 0 && (
            <View style={styles.messagesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>New Messages</Text>
                <TouchableOpacity onPress={() => setShowMessages(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                style={styles.messagesList}
              />
            </View>
          )}

          {/* Friends List */}
          <View style={styles.friendsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Send a message</Text>
              <Text style={styles.friendsCount}>{friends.length} friends</Text>
            </View>
            {friends.length > 0 ? (
              <FlatList
                data={friends}
                renderItem={renderFriend}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                extraData={friends}
              />
            ) : (
              <TouchableOpacity
                style={styles.addFriendPrompt}
                onPress={() => setAddFriendModalVisible(true)}
              >
                <Ionicons name="person-add-outline" size={32} color={theme.colors.accent.teal} />
                <Text style={styles.addFriendText}>Add your first friend</Text>
                <Text style={styles.addFriendSubtext}>Share friend codes to connect</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Empty State */}
          {newMessageCount === 0 && !showMessages && friends.length > 0 && (
            <View style={styles.emptyStateWrapper}>
              <View style={styles.emptyState}>
                <Animated.View 
                  style={[
                    styles.emptyIconContainer,
                    {
                      transform: [
                        {
                          translateY: floatAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -10],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.ghostContainer}>
                    <Ionicons name="chatbubble-outline" size={60} color={theme.colors.text.tertiary} />
                    <View style={styles.ghostEyes}>
                      <View style={styles.ghostEye} />
                      <View style={styles.ghostEye} />
                    </View>
                  </View>
                  <View style={styles.vanishEffect}>
                    <View style={styles.vanishDot} />
                    <View style={[styles.vanishDot, styles.vanishDotMedium]} />
                    <View style={[styles.vanishDot, styles.vanishDotSmall]} />
                  </View>
                </Animated.View>
                <Text style={styles.emptyTitle}>No New Messages</Text>
                <Text style={styles.emptySubtext}>
                  New messages will appear here{'\n'}and will be deleted forever after you listen
                </Text>
              </View>
            </View>
          )}
          </View>
        )}
        keyExtractor={(item) => item.key}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }} 
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setActionModalVisible(true)}
      >
        <Ionicons name="add" size={32} color={theme.colors.text.inverse} />
      </TouchableOpacity>

      {/* Action Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={actionModalVisible}
        onRequestClose={() => setActionModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActionModalVisible(false)}
        >
          <View style={styles.actionModal}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                setActionModalVisible(false);
                setAddFriendModalVisible(true);
              }}
            >
              <Ionicons name="person-add-outline" size={24} color={theme.colors.text.primary} />
              <Text style={styles.actionText}>Add Friend</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={randomConnect}
            >
              <Ionicons name="shuffle-outline" size={24} color={theme.colors.text.primary} />
              <Text style={styles.actionText}>Random Connect</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Friend Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addFriendModalVisible}
        onRequestClose={() => setAddFriendModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter friend code"
              value={friendCode}
              onChangeText={setFriendCode}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setAddFriendModalVisible(false);
                  setFriendCode('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={addFriend}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Recording Modal */}
      <RecordingModal
        visible={recordingModalVisible}
        recipientName={recordingFor?.name || ''}
        recipientId={recordingFor?.id || ''}
        userId={user?.id || ''}
        onClose={() => {
          setRecordingModalVisible(false);
          setRecordingFor(null);
        }}
        onSend={handleSendMessage}
      />

    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface.primary,
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
  },
  messageCounter: {
    backgroundColor: theme.colors.primary.main,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.large,
  },
  counterDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.accent.teal,
    marginBottom: theme.spacing.md,
  },
  counterText: {
    ...theme.typography.displayLarge,
    color: theme.colors.text.inverse,
    marginBottom: theme.spacing.xs,
  },
  tapToReveal: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.muted,
  },
  messagesSection: {
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.headlineLarge,
    color: theme.colors.text.primary,
  },
  messagesList: {
    maxHeight: 300,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface.secondary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.small,
  },
  messageContent: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  senderName: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  messageTime: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  friendsSection: {
    flex: 1,
    marginTop: theme.spacing.xl,
  },
  friendsCount: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.tertiary,
    fontWeight: '500',
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  friendAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  friendAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  friendCode: {
    fontSize: 14,
    color: '#666',
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0FFFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 92,
  },
  swipeActions: {
    flexDirection: 'row',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  blockAction: {
    backgroundColor: '#FF9500',
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
  },
  addFriendPrompt: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    marginHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  addFriendText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  addFriendSubtext: {
    fontSize: 14,
    color: '#666',
  },
  emptyStateWrapper: {
    flex: 1,
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  ghostContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostEyes: {
    position: 'absolute',
    flexDirection: 'row',
    top: 20,
    gap: 12,
  },
  ghostEye: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCCCCC',
  },
  vanishEffect: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    flexDirection: 'row',
    gap: 4,
  },
  vanishDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    opacity: 0.6,
  },
  vanishDotMedium: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.4,
  },
  vanishDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.2,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingBottom: 90,
  },
  actionModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    minWidth: 180,
  },
  actionText: {
    marginLeft: 15,
    fontSize: 16,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#1A1A1A',
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});