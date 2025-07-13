import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { supabase } from '../services/supabase';

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
  lastMessage?: {
    content: string;
    timestamp: string;
    isVoice: boolean;
  };
}

export default function FriendsListScreen({ navigation }: any) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (user) {
      loadFriends();
    }
  }, [user]);

  const loadFriends = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load friends with their details
      const { data: friendsData, error } = await supabase
        .from('friends')
        .select(`
          *,
          friend:users!friends_friend_id_fkey(
            friend_code,
            avatar_seed,
            username
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      // Load last message for each friend
      const friendsWithLastMessage = await Promise.all(
        (friendsData || []).map(async (friend) => {
          // Get the last message between this user and friend
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},recipient_id.eq.${friend.friend_id}),and(sender_id.eq.${friend.friend_id},recipient_id.eq.${user.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...friend,
            lastMessage: lastMessage ? {
              content: lastMessage.type === 'text' 
                ? lastMessage.content 
                : '🎤 Voice message',
              timestamp: new Date(lastMessage.created_at),
              isFromMe: lastMessage.sender_id === user.id
            } : null
          };
        })
      );

      setFriends(friendsWithLastMessage);
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFriends();
    setRefreshing(false);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const validateUsername = (username: string): boolean => {
    if (!username.trim()) {
      setSearchError('Please enter a username');
      return false;
    }
    
    if (username.length < 3) {
      setSearchError('Username must be at least 3 characters');
      return false;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setSearchError('Username can only contain letters, numbers, and underscores');
      return false;
    }
    
    setSearchError('');
    return true;
  };

  const addFriend = async () => {
    const username = searchUsername.trim();
    if (!validateUsername(username) || !user) return;

    try {
      setIsSearching(true);

      // Find user by username (case-insensitive)
      const { data: targetUser, error: findError } = await supabase
        .from('users')
        .select('id, friend_code, username')
        .ilike('username', username)
        .single();

      if (findError || !targetUser) {
        setSearchError('User not found');
        return;
      }

      if (targetUser.id === user.id) {
        setSearchError('You cannot add yourself as a friend');
        return;
      }

      // Check if already friends (check both directions)
      const { data: existingFriend } = await supabase
        .from('friends')
        .select('id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${user.id})`)
        .single();

      if (existingFriend) {
        setSearchError('You are already friends with this user');
        return;
      }

      // Add friend (bidirectional)
      const { error: addError } = await supabase
        .from('friends')
        .insert([
          {
            user_id: user.id,
            friend_id: targetUser.id,
            nickname: targetUser.username || `User ${targetUser.friend_code}`
          },
          {
            user_id: targetUser.id,
            friend_id: user.id,
            nickname: user.username || `User ${user.friend_code}`
          }
        ]);

      if (addError) throw addError;

      // Close modal and clear form first
      setAddFriendModalVisible(false);
      setSearchUsername('');
      setSearchError('');
      
      // Refresh friends list
      await loadFriends();
      
      // Show success feedback with action options
      Alert.alert(
        'Friend Added! 🎉', 
        `${targetUser.username} has been added to your friends list. You can now start chatting!`,
        [
          { text: 'Maybe Later', style: 'cancel' },
          { 
            text: 'Start Chatting', 
            onPress: () => navigateToChat({
              id: 'temp', // Will be replaced by the actual friend record
              friend_id: targetUser.id,
              friend: { username: targetUser.username, friend_code: targetUser.friend_code },
              nickname: targetUser.username
            })
          }
        ]
      );
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend');
    } finally {
      setIsSearching(false);
    }
  };

  const navigateToChat = (friend: Friend) => {
    const friendName = friend.friend?.username || friend.nickname || 'Anonymous User';
    const displayName = friendName.startsWith('User ') ? 'Anonymous User' : friendName;
    
    navigation.navigate('FriendChat', {
      friendId: friend.friend_id,
      friendName: displayName,
      friendUsername: friend.friend?.username,
    });
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const friendName = item.friend?.username || item.nickname || 'Anonymous User';
    const displayName = friendName.startsWith('User ') ? 'Anonymous User' : friendName;
    const lastMessage = item.lastMessage;

    return (
      <TouchableOpacity
        style={styles.friendItem}
        onPress={() => navigateToChat(item)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.friendInfo}>
          <View style={styles.friendHeader}>
            <Text style={styles.friendName}>{displayName}</Text>
            {item.mutual && (
              <Ionicons name="people" size={16} color="#4ECDC4" />
            )}
          </View>
          
          {item.friend?.username && (
            <Text style={styles.friendUsername}>
              @{item.friend.username}
            </Text>
          )}
          
          {lastMessage && (
            <View style={styles.lastMessageContainer}>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {lastMessage.isFromMe ? 'You: ' : ''}{lastMessage.content}
              </Text>
              <Text style={styles.timestamp}>
                {formatTimestamp(lastMessage.timestamp)}
              </Text>
            </View>
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Friends Yet</Text>
      <Text style={styles.emptySubtitle}>
        Add friends to start chatting!
      </Text>
      <TouchableOpacity
        style={styles.addFirstFriendButton}
        onPress={() => setAddFriendModalVisible(true)}
      >
        <Text style={styles.addFirstFriendText}>Add Your First Friend</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('AnonymousLobby')}
          >
            <Ionicons name="shuffle-outline" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setAddFriendModalVisible(true)}
          >
            <Ionicons name="person-add" size={24} color="#4ECDC4" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Friends List */}
      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={friends.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Friend Modal */}
      <Modal
        visible={addFriendModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setAddFriendModalVisible(false);
                setSearchUsername('');
                setSearchError('');
              }}
            >
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TouchableOpacity onPress={addFriend} disabled={!searchUsername.trim() || isSearching}>
              <Text style={[
                styles.addButton,
                (!searchUsername.trim() || isSearching) && styles.addButtonDisabled
              ]}>
                {isSearching ? 'Searching...' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={[styles.usernameInput, searchError ? styles.inputError : null]}
              value={searchUsername}
              onChangeText={(text) => {
                setSearchUsername(text);
                setSearchError('');
              }}
              placeholder="Enter username"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            
            {searchError ? (
              <Text style={styles.errorText}>{searchError}</Text>
            ) : (
              <Text style={styles.helpText}>
                Search for friends by their username
              </Text>
            )}
            
            {user && !user.username && (
              <View style={styles.warningContainer}>
                <Ionicons name="information-circle" size={20} color="#FF9500" />
                <Text style={styles.warningText}>
                  Set your username in Profile to let friends find you
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  friendInfo: {
    flex: 1,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  friendUsername: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageIcon: {
    marginRight: 2,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  addFirstFriendButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  addFirstFriendText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  addButtonDisabled: {
    color: '#ccc',
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  usernameInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  yourCodeContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  yourCodeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  yourCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ECDC4',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    flex: 1,
  },
});