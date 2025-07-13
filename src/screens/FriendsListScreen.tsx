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
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { supabase } from '../services/supabase';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

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
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadFriends();
      loadPendingRequests();
      
      // Subscribe to friend requests (incoming)
      const requestsSubscription = supabase
        .channel(`friend-requests:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friend_requests',
            filter: `to_user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Friend request change (incoming):', payload);
            // Reload pending requests when there's a change
            loadPendingRequests();
          }
        )
        .subscribe();

      // Subscribe to friend requests (outgoing - to know when accepted)
      const outgoingRequestsSubscription = supabase
        .channel(`friend-requests-sent:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'friend_requests',
            filter: `from_user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Friend request update (outgoing):', payload);
            // If request was accepted, reload friends and show notification
            if (payload.new.status === 'accepted') {
              console.log('Friend request accepted! Reloading friends...');
              loadFriends();
              
              // Get the username of who accepted
              supabase
                .from('users')
                .select('username')
                .eq('id', payload.new.to_user_id)
                .single()
                .then(({ data }) => {
                  if (data) {
                    Alert.alert(
                      'Friend Request Accepted! 🎉',
                      `${data.username} accepted your friend request!`
                    );
                  }
                });
            }
          }
        )
        .subscribe();

      // Subscribe to friends table changes
      const friendsSubscription = supabase
        .channel(`friends:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friends',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Friends list change:', payload);
            // Reload friends when there's a change
            loadFriends();
          }
        )
        .subscribe();

      return () => {
        requestsSubscription.unsubscribe();
        outgoingRequestsSubscription.unsubscribe();
        friendsSubscription.unsubscribe();
      };
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
    await Promise.all([loadFriends(), loadPendingRequests()]);
    setRefreshing(false);
  };

  const loadPendingRequests = async () => {
    if (!user) return;

    try {
      // Load friend requests where this user is the recipient
      const { data: requests, error } = await supabase
        .from('friend_requests')
        .select(`
          *,
          from_user:users!friend_requests_from_user_id_fkey(
            id,
            username,
            friend_code
          )
        `)
        .eq('to_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('[FriendsListScreen] Loaded pending requests:', requests?.length || 0);
      setPendingRequests(requests || []);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
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

      // Check if there's already a pending request
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('id, status')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${targetUser.id}),and(from_user_id.eq.${targetUser.id},to_user_id.eq.${user.id})`)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        setSearchError('A friend request is already pending with this user');
        return;
      }

      // Send friend request instead of adding directly
      const { error: requestError } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: user.id,
          to_user_id: targetUser.id,
          status: 'pending'
        });

      if (requestError) throw requestError;

      // Close modal and clear form first
      setAddFriendModalVisible(false);
      setSearchUsername('');
      setSearchError('');
      
      // Show success feedback for friend request
      Alert.alert(
        'Friend Request Sent! 📤', 
        `Your friend request has been sent to ${targetUser.username}. They'll need to accept it before you can start chatting.`,
        [{ text: 'OK' }]
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

  const removeFriend = async (friend: Friend) => {
    const friendName = friend.friend?.username || friend.nickname || 'Anonymous User';
    
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Only remove the friendship from this user's perspective
              const { error } = await supabase
                .from('friends')
                .delete()
                .match({
                  user_id: user.id,
                  friend_id: friend.friend_id
                });

              if (error) throw error;

              Alert.alert('Friend Removed', `${friendName} has been removed from your friends list.`);
              loadFriends();
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  const handleFriendRequest = async (requestId: string, fromUserId: string, accept: boolean) => {
    try {
      if (accept) {
        // Update request status to accepted
        const { error: updateError } = await supabase
          .from('friend_requests')
          .update({ 
            status: 'accepted',
            responded_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (updateError) throw updateError;

        // Create bidirectional friendship
        // Insert them separately to ensure both are created
        const { error: friendError1 } = await supabase
          .from('friends')
          .insert({
            user_id: user.id,
            friend_id: fromUserId
          });

        if (friendError1) {
          console.error('Error creating first friendship:', friendError1);
          throw friendError1;
        }

        const { error: friendError2 } = await supabase
          .from('friends')
          .insert({
            user_id: fromUserId,
            friend_id: user.id
          });

        if (friendError2) {
          console.error('Error creating second friendship:', friendError2);
          throw friendError2;
        }

        Alert.alert('Success', 'Friend request accepted!');
      } else {
        // Update request status to rejected
        const { error } = await supabase
          .from('friend_requests')
          .update({ 
            status: 'rejected',
            responded_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (error) throw error;
      }

      // Refresh both lists
      await Promise.all([loadFriends(), loadPendingRequests()]);
    } catch (error) {
      console.error('Error handling friend request:', error);
      Alert.alert('Error', 'Failed to process friend request');
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const friendName = item.friend?.username || item.nickname || 'Anonymous User';
    const displayName = friendName.startsWith('User ') ? 'Anonymous User' : friendName;
    const lastMessage = item.lastMessage;

    const renderRightActions = () => {
      return (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => removeFriend(item)}
        >
          <Ionicons name="trash-outline" size={24} color="#fff" />
          <Text style={styles.deleteButtonText}>Remove</Text>
        </TouchableOpacity>
      );
    };

    return (
      <Swipeable
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
      >
        <TouchableOpacity
          style={styles.friendItem}
          onPress={() => navigateToChat(item)}
          activeOpacity={0.95}
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
      </Swipeable>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Friends</Text>
          {pendingRequests.length > 0 && (
            <View style={styles.requestBadge}>
              <Text style={styles.requestBadgeText}>{pendingRequests.length}</Text>
            </View>
          )}
        </View>
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
        ListHeaderComponent={
          pendingRequests.length > 0 ? (
            <View style={styles.requestsSection}>
              <Text style={styles.requestsTitle}>Friend Requests ({pendingRequests.length})</Text>
              {pendingRequests.map((request) => (
                <View key={request.id} style={styles.requestItem}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestUsername}>
                      {request.from_user?.username || 'Anonymous User'}
                    </Text>
                    <Text style={styles.requestTime}>
                      {formatTimestamp(new Date(request.created_at))}
                    </Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.requestButton, styles.declineButton]}
                      onPress={() => handleFriendRequest(request.id, request.from_user_id, false)}
                    >
                      <Ionicons name="close" size={20} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.requestButton, styles.acceptButton]}
                      onPress={() => handleFriendRequest(request.id, request.from_user_id, true)}
                    >
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={friends.length === 0 && pendingRequests.length === 0 ? styles.emptyList : undefined}
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
  deleteButton: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
    flexDirection: 'column',
    paddingHorizontal: 20,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  requestsSection: {
    backgroundColor: '#FFF8E1',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  requestsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 12,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  requestInfo: {
    flex: 1,
  },
  requestUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  requestTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#F5F5F5',
  },
  acceptButton: {
    backgroundColor: '#4ECDC4',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  requestBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});