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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { Audio } from 'expo-av';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { supabase } from '../services/supabase';
import RecordingModal from '../components/RecordingModal';
import { useFocusEffect } from '@react-navigation/native';
import { downloadAudio } from '../utils/audioStorage';

interface Message {
  id: string;
  sender_id: string;
  created_at: string;
  media_path: string;
  sender?: {
    friend_code: string;
    avatar_seed: string;
  };
}

interface Friend {
  id: string;
  friend_id: string;
  nickname?: string;
  friend?: {
    friend_code: string;
    avatar_seed: string;
  };
}

export default function EphemeralInboxScreen({ navigation }: any) {
  const { user } = useAuth();
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
      
      // Poll for new messages every 5 seconds
      const pollInterval = setInterval(() => {
        fetchData();
      }, 5000);

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

  const fetchData = async () => {
    try {
      // Fetch unplayed messages count
      const { count, data: messagesData } = await supabase
        .from('messages')
        .select('*, sender:sender_id(friend_code, avatar_seed)', { count: 'exact' })
        .eq('recipient_id', user?.id)
        .eq('expired', false)
        .is('listened_at', null)
        .order('created_at', { ascending: false });

      const newCount = count || 0;
      
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
      setMessages(messagesData || []);

      // Fetch friends for sending
      const { data: friendsData } = await supabase
        .from('friends')
        .select('*, friend:friend_id(friend_code, avatar_seed)')
        .eq('user_id', user?.id);

      setFriends(friendsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const playMessage = async (message: Message) => {
    try {
      setPlayingMessage(message.id);

      // Download the audio file if it's not a placeholder
      if (message.media_path === 'placeholder') {
        // Show alert for placeholder messages
        Alert.alert(
          'Voice Message',
          'This is a test message. Real audio playback is now available for new messages!',
          [{ text: 'OK' }]
        );
        
        setTimeout(() => {
          vanishMessage(message.id);
        }, 2000);
        return;
      }

      // Download the audio file
      const localUri = await downloadAudio(message.media_path);
      
      if (!localUri) {
        throw new Error('Failed to download audio');
      }

      // Set audio mode to play through speaker
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Play the audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: localUri },
        { 
          shouldPlay: true,
          volume: 1.0,
        }
      );
      setSound(newSound);

      // Mark as listened
      await supabase
        .from('messages')
        .update({ listened_at: new Date().toISOString() })
        .eq('id', message.id);

      // Wait for playback to finish
      newSound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          // Vanish the message
          vanishMessage(message.id);
          // Unload the sound
          newSound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Error playing message:', error);
      Alert.alert('Error', 'Failed to play message. Please try again.');
      setPlayingMessage(null);
    }
  };

  const vanishMessage = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ expired: true })
        .eq('id', messageId);

      // Remove from local state
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setNewMessageCount(prev => Math.max(0, prev - 1));
      setPlayingMessage(null);

      // If no more messages, hide the revealed list
      if (messages.length <= 1) {
        setShowMessages(false);
      }
    } catch (error) {
      console.error('Error vanishing message:', error);
    }
  };

  const handleSendMessage = async (audioPath: string, duration: number) => {
    if (!recordingFor || !user) return;

    try {
      const expiryRule = {
        type: 'playback',
        play_count: 1,
      };

      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: recordingFor.id,
        media_path: audioPath, // Now using real audio path
        expiry_rule: expiryRule,
      });

      if (error) throw error;

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
    // Use the same random connect logic from before
    Alert.alert('Random Connect', 'Finding someone to connect with...');
  };

  const getAvatarColor = (seed: string = '') => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
    const index = seed.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const deleteFriend = async (friendId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', user?.id)
        .eq('friend_id', friendId);

      if (!error) {
        Alert.alert('Success', 'Friend removed');
        fetchData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to remove friend');
    }
  };

  const blockUser = async (friendId: string) => {
    // For now, just remove them. In future, add blocked_users table
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? They will be removed from your friends.',
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
          <Ionicons name="ban" size={24} color="#fff" />
          <Text style={styles.swipeActionText}>Block</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, styles.deleteAction]}
          onPress={() => deleteFriend(friendId)}
        >
          <Ionicons name="trash" size={24} color="#fff" />
          <Text style={styles.swipeActionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <TouchableOpacity
      style={styles.messageItem}
      onPress={() => playMessage(item)}
      disabled={playingMessage === item.id}
    >
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.sender?.avatar_seed) }]}>
        <Text style={styles.avatarText}>
          {(item.sender?.friend_code || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.messageContent}>
        <Text style={styles.senderName}>From: {item.sender?.friend_code || 'Unknown'}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.created_at).toLocaleTimeString()}
        </Text>
      </View>
      {playingMessage === item.id ? (
        <Ionicons name="volume-high" size={24} color="#4ECDC4" />
      ) : (
        <Ionicons name="play-circle" size={32} color="#000" />
      )}
    </TouchableOpacity>
  );

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
            name: item.nickname || item.friend?.friend_code || 'Friend',
          });
          setRecordingModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.friendAvatar, { backgroundColor: getAvatarColor(item.friend?.avatar_seed) }]}>
          <Text style={styles.friendAvatarText}>
            {(item.nickname || item.friend?.friend_code || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>
            {item.nickname || 'Anonymous'}
          </Text>
          <Text style={styles.friendCode}>
            {item.friend?.friend_code || 'Unknown'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.micButton}
          onPress={() => {
            setRecordingFor({
              id: item.friend_id,
              name: item.nickname || item.friend?.friend_code || 'Friend',
            });
            setRecordingModalVisible(true);
          }}
        >
          <Ionicons name="mic" size={24} color="#4ECDC4" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text>Loading...</Text>
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
                  <Ionicons name="close" size={24} color="#666" />
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
              />
            ) : (
              <TouchableOpacity
                style={styles.addFriendPrompt}
                onPress={() => setAddFriendModalVisible(true)}
              >
                <Ionicons name="person-add-outline" size={32} color="#4ECDC4" />
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
                    <Ionicons name="chatbubble-outline" size={60} color="#E0E0E0" />
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
        <Ionicons name="add" size={32} color="#fff" />
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
              <Ionicons name="person-add-outline" size={24} color="#000" />
              <Text style={styles.actionText}>Add Friend</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={randomConnect}
            >
              <Ionicons name="shuffle-outline" size={24} color="#000" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageCounter: {
    backgroundColor: '#1A1A1A',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  counterDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ECDC4',
    marginBottom: 15,
  },
  counterText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  tapToReveal: {
    fontSize: 15,
    color: '#999',
    fontWeight: '500',
  },
  messagesSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  messagesList: {
    maxHeight: 300,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageContent: {
    flex: 1,
    marginLeft: 12,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  friendsSection: {
    flex: 1,
    marginTop: 24,
  },
  friendsCount: {
    fontSize: 14,
    color: '#999',
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