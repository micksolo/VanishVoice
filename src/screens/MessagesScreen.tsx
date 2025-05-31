import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { supabase } from '../services/supabase';
import { Audio } from 'expo-av';
import RecordingModal from '../components/RecordingModal';

interface Message {
  id: string;
  sender_id: string;
  created_at: string;
  listened_at: string | null;
  expiry_rule: any;
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

type ConversationItem = {
  type: 'message' | 'friend';
  data: Message | Friend;
  lastMessage?: string;
  unread?: boolean;
};

export default function MessagesScreen({ navigation }: any) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [recordingModalVisible, setRecordingModalVisible] = useState(false);
  const [recordingFor, setRecordingFor] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  const fetchConversations = async () => {
    try {
      // Fetch messages
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(friend_code, avatar_seed)
        `)
        .eq('recipient_id', user?.id)
        .eq('expired', false)
        .order('created_at', { ascending: false });

      // Fetch friends
      const { data: friends, error: friendError } = await supabase
        .from('friends')
        .select(`
          *,
          friend:friend_id(friend_code, avatar_seed)
        `)
        .eq('user_id', user?.id);

      if (msgError) throw msgError;
      if (friendError) throw friendError;

      // Combine and organize conversations
      const conversationMap = new Map<string, ConversationItem>();

      // Add friends
      friends?.forEach(friend => {
        conversationMap.set(friend.friend_id, {
          type: 'friend',
          data: friend,
          lastMessage: 'Tap to send a message',
          unread: false,
        });
      });

      // Add/update with messages
      messages?.forEach(message => {
        const existing = conversationMap.get(message.sender_id);
        if (existing) {
          existing.lastMessage = 'New voice message';
          existing.unread = !message.listened_at;
        } else {
          conversationMap.set(message.sender_id, {
            type: 'message',
            data: message,
            lastMessage: 'New voice message',
            unread: !message.listened_at,
          });
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getAvatarColor = (seed: string = '') => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
    const index = seed.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getDisplayName = (item: ConversationItem) => {
    if (item.type === 'friend') {
      const friend = item.data as Friend;
      return friend.nickname || friend.friend?.friend_code || 'Friend';
    } else {
      const message = item.data as Message;
      return message.sender?.friend_code || 'Anonymous';
    }
  };

  const handleConversationPress = (item: ConversationItem) => {
    if (item.type === 'message') {
      // Play the message
      const message = item.data as Message;
      // TODO: Navigate to message player
      Alert.alert('Play Message', 'Message playback coming soon!');
    } else {
      // Start recording for this friend
      const friend = item.data as Friend;
      setRecordingFor({ id: friend.friend_id, name: getDisplayName(item) });
      setRecordingModalVisible(true);
    }
  };

  const handleRecordingSend = async (uri: string, duration: number) => {
    if (!recordingFor || !user) return;

    try {
      // TODO: Upload audio to storage
      // TODO: Encrypt audio
      
      const expiryRule = {
        type: 'time',
        duration_sec: 60, // Default 60 seconds expiry
      };

      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: recordingFor.id,
        media_path: 'placeholder', // TODO: Real upload path
        expiry_rule: expiryRule,
      });

      if (error) throw error;

      Alert.alert(
        'Sent!',
        `Voice message sent to ${recordingFor.name}`,
        [{ text: 'OK' }]
      );
      
      setRecordingModalVisible(false);
      setRecordingFor(null);
      fetchConversations();
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
      // Find user by friend code
      const { data: friendUser, error: findError } = await supabase
        .from('users')
        .select('id')
        .eq('friend_code', friendCode.trim())
        .single();

      if (findError || !friendUser) {
        Alert.alert('Error', 'Friend code not found');
        return;
      }

      // Add friend
      const { error: addError } = await supabase
        .from('friends')
        .insert({
          user_id: user?.id,
          friend_id: friendUser.id,
        });

      if (addError) {
        if (addError.code === '23505') {
          Alert.alert('Error', 'Already friends with this user');
        } else {
          throw addError;
        }
        return;
      }

      Alert.alert('Success', 'Friend added successfully!');
      setModalVisible(false);
      setFriendCode('');
      fetchConversations();
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend');
    }
  };

  const randomConnect = async () => {
    setActionModalVisible(false);
    
    try {
      // Show loading state
      Alert.alert(
        'Random Connect',
        'Finding someone to connect with...',
        [{ text: 'Cancel', style: 'cancel' }],
        { cancelable: false }
      );

      // Call the matching function
      const { data, error } = await supabase
        .rpc('match_random_users', { requesting_user_id: user?.id });

      if (error) throw error;

      if (data) {
        // Match found! Get the matched user's info
        const { data: matchedUser } = await supabase
          .from('users')
          .select('friend_code, avatar_seed')
          .eq('id', data)
          .single();

        if (matchedUser) {
          // Automatically add as friend
          await supabase
            .from('friends')
            .insert({
              user_id: user?.id,
              friend_id: data,
              nickname: `Random: ${matchedUser.friend_code}`,
            });

          // Also add reverse friendship
          await supabase
            .from('friends')
            .insert({
              user_id: data,
              friend_id: user?.id,
              nickname: `Random: ${user?.friend_code}`,
            });

          Alert.alert(
            'Connected!',
            `You've been matched with ${matchedUser.friend_code}! You can now send them messages.`,
            [{ 
              text: 'Send Message', 
              onPress: () => {
                setRecordingFor({ id: data, name: `Random: ${matchedUser.friend_code}` });
                setRecordingModalVisible(true);
              }
            }]
          );

          fetchConversations();
        }
      } else {
        // No match yet, user is in waiting queue
        Alert.alert(
          'Waiting for Match',
          'You\'re in the queue! We\'ll match you with the next person who uses Random Connect.',
          [{ text: 'OK' }]
        );

        // Poll for matches for 30 seconds
        let pollCount = 0;
        const pollInterval = setInterval(async () => {
          pollCount++;
          
          const { data: connection } = await supabase
            .from('random_connections')
            .select('status, matched_with')
            .eq('user_id', user?.id)
            .single();

          if (connection?.status === 'matched' && connection.matched_with) {
            clearInterval(pollInterval);
            
            // Get matched user info
            const { data: matchedUser } = await supabase
              .from('users')
              .select('friend_code')
              .eq('id', connection.matched_with)
              .single();

            Alert.alert(
              'Match Found!',
              `You've been matched with ${matchedUser?.friend_code}!`,
              [{ text: 'OK' }]
            );

            fetchConversations();
          } else if (pollCount >= 6) { // Stop after 30 seconds
            clearInterval(pollInterval);
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Random connect error:', error);
      Alert.alert('Error', 'Failed to connect. Please try again.');
    }
  };

  const renderConversation = ({ item }: { item: ConversationItem }) => {
    const name = getDisplayName(item);
    const avatarSeed = item.type === 'friend' 
      ? (item.data as Friend).friend?.avatar_seed 
      : (item.data as Message).sender?.avatar_seed;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => handleConversationPress(item)}
      >
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(avatarSeed) }]}>
          <Text style={styles.avatarText}>{name[0].toUpperCase()}</Text>
        </View>
        <View style={styles.conversationContent}>
          <Text style={styles.conversationName}>{name}</Text>
          <Text style={[
            styles.conversationMessage,
            item.unread && styles.unreadMessage
          ]}>
            {item.lastMessage}
          </Text>
        </View>
        {item.unread && <View style={styles.unreadDot} />}
        {item.type === 'friend' && (
          <Ionicons name="mic-outline" size={24} color="#666" />
        )}
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={80} color="#ddd" />
      <Text style={styles.emptyText}>No conversations yet</Text>
      <Text style={styles.emptySubtext}>
        Add friends or try random connect to start chatting
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => 
          item.type === 'friend' 
            ? `friend-${(item.data as Friend).id}`
            : `msg-${(item.data as Message).id}`
        }
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={EmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchConversations();
          }} />
        }
      />

      {/* Floating Action Button */}
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
                setModalVisible(true);
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
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
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
                  setModalVisible(false);
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
        onClose={() => {
          setRecordingModalVisible(false);
          setRecordingFor(null);
        }}
        onSend={handleRecordingSend}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  emptyContainer: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  conversationContent: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
  },
  conversationMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  unreadMessage: {
    color: '#000',
    fontWeight: '500',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ECDC4',
    marginRight: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    color: '#333',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#000',
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