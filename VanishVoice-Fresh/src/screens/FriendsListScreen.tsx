import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Animated,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme';
import { supabase, debugRealtimeConnection } from '../services/supabase';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { MessageNotificationData, sendFriendRequestNotification } from '../services/pushNotifications';
import FriendEncryption from '../utils/friendEncryption';
import { SafeAreaView, Button, Card, IconButton, Input, Loading, EmptyState } from '../components/ui';
import FloatingActionMenu from '../components/FloatingActionMenu';

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
  unreadCount?: number;
  lastMessage?: {
    id: string;
    type: 'text' | 'voice';
    content: string;
    created_at: string;
    is_mine: boolean;
  };
}

export default function FriendsListScreen({ navigation }: any) {
  const { user } = useAuth();
  const theme = useAppTheme();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const usernameInputRef = useRef<any>(null);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const focusPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const notifiedRequests = useRef<Set<string>>(new Set());
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const lastMessageChecksum = useRef<string>('');
  const pollFrequency = useRef<number>(3000); // Start at 3 seconds

  // Set up push notification listener
  useEffect(() => {
    if (!user) return;

    // Listen for notifications when app is foregrounded
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[FriendsListScreen] Push notification received:', notification);
      
      const data = notification.request.content.data as MessageNotificationData;
      
      if (data.type === 'new_message' && data.sender_id) {
        console.log('[FriendsListScreen] New message notification from:', data.sender_id);
        
        // Update unread count for specific friend immediately
        setFriends(prevFriends => 
          prevFriends.map(friend => 
            friend.friend_id === data.sender_id 
              ? { ...friend, unreadCount: (friend.unreadCount || 0) + 1 }
              : friend
          )
        );
        
        // Also update total unread count
        updateUnreadCounts();
      } else if (data.type === 'friend_request' && data.sender_name) {
        console.log('[FriendsListScreen] Friend request notification from:', data.sender_name);
        
        // Just reload pending requests to show the new one
        // No need for an alert as the push notification already notified the user
        loadPendingRequests();
      }
    });

    return () => {
      notificationListener.remove();
    };
  }, [user]);

  // Handle screen focus - load data once when focused, no polling
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        setIsScreenFocused(true);
        
        // Load data once when screen is focused
        const loadScreenData = async () => {
          await Promise.all([
            loadFriends(),
            loadPendingRequests(),
            updateUnreadCounts()
          ]);
        };
        
        loadScreenData();
        
        // Only poll for friend request acceptances (temporary until push is fully working)
        const friendRequestInterval = setInterval(() => {
          checkAcceptedRequests();
        }, 10000); // Check every 10 seconds for accepted requests only
        
        return () => {
          setIsScreenFocused(false);
          clearInterval(friendRequestInterval);
        };
      }
    }, [user])
  );

  // Update unread counts for all friends with adaptive polling
  const updateUnreadCounts = async () => {
    if (!user) return;
    
    try {
      // Get unread message summary in a single efficient query
      const { data: unreadSummary, error } = await supabase
        .from('messages')
        .select('sender_id, id')
        .eq('recipient_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to prevent huge queries
      
      if (error) {
        console.error('[FriendsListScreen] Error fetching unread counts:', error);
        return;
      }
      
      // Create a checksum to detect changes
      const currentChecksum = JSON.stringify(unreadSummary?.map(m => m.id).sort() || []);
      const hasChanges = currentChecksum !== lastMessageChecksum.current;
      
      if (hasChanges) {
        console.log('[FriendsListScreen] New messages detected!');
        lastMessageChecksum.current = currentChecksum;
        
        // Reset to fast polling when new messages arrive
        pollFrequency.current = 3000;
        
        // Count messages per sender
        const unreadCounts: Record<string, number> = {};
        (unreadSummary || []).forEach(msg => {
          unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1;
        });
        
        // Update friends with new counts
        setFriends(prevFriends => 
          prevFriends.map(friend => ({
            ...friend,
            unreadCount: unreadCounts[friend.friend_id] || 0
          }))
        );
        
        console.log('[FriendsListScreen] Updated unread counts:', unreadCounts);
      } else {
        // No changes - gradually slow down polling
        pollFrequency.current = Math.min(pollFrequency.current * 1.5, 30000); // Max 30 seconds
        console.log('[FriendsListScreen] No new messages, slowing poll to', pollFrequency.current, 'ms');
      }
    } catch (error) {
      console.error('[FriendsListScreen] Error updating unread counts:', error);
    }
  };

  // Check for accepted friend requests periodically
  const checkAcceptedRequests = async () => {
    if (!user) return;
    
    try {
      // Check outgoing requests that might have been accepted
      const { data: sentRequests } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('from_user_id', user.id)
        .eq('status', 'accepted')
        .gt('responded_at', new Date(Date.now() - 60000).toISOString()); // Last minute

      if (sentRequests && sentRequests.length > 0) {
        console.log('[FriendsListScreen] Found recently accepted requests:', sentRequests.length);
        
        // Check if these are new (not already in friends list)
        const currentFriendIds = friends.map(f => f.friend_id);
        const newlyAccepted = sentRequests.filter(req => !currentFriendIds.includes(req.to_user_id));
        
        if (newlyAccepted.length > 0) {
          // Filter out requests we've already notified about
          const unnotifiedRequests = newlyAccepted.filter(req => !notifiedRequests.current.has(req.id));
          
          if (unnotifiedRequests.length > 0) {
            console.log('[FriendsListScreen] New friends detected via polling!');
            loadFriends();
            
            // Get usernames for notification
            for (const request of unnotifiedRequests) {
              // Mark as notified
              notifiedRequests.current.add(request.id);
              
              const { data: userData } = await supabase
                .from('users')
                .select('username')
                .eq('id', request.to_user_id)
                .single();
                
              if (userData) {
                Alert.alert(
                  'Friend Request Accepted! 🎉',
                  `${userData.username} accepted your friend request!`
                );
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[FriendsListScreen] Error checking accepted requests:', error);
    }
  };

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('[FriendsListScreen] App state changed to:', nextAppState);
      if (nextAppState === 'active' && isScreenFocused) {
        // App became active and screen is focused - refresh data
        loadFriends();
        loadPendingRequests();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isScreenFocused, user]);

  useEffect(() => {
    if (user) {
      loadFriends();
      loadPendingRequests();
      
      // Start background polling for accepted requests (less frequent)
      pollingInterval.current = setInterval(checkAcceptedRequests, 15000); // Check every 15 seconds
      
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
          async (payload) => {
            // Show alert for new friend requests
            if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
              // Get sender's username
              const { data: sender } = await supabase
                .from('users')
                .select('username')
                .eq('id', payload.new.from_user_id)
                .single();
              
              if (sender) {
                Alert.alert(
                  'New Friend Request! 👋',
                  `${sender.username} wants to be your friend`,
                  [
                    { text: 'View', onPress: () => loadPendingRequests() }
                  ]
                );
              }
            }
            
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
            // If request was accepted, reload friends and show notification
            if (payload.new && payload.new.status === 'accepted') {
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

      // Subscribe to friends table changes (when this user's friendships change)
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
            loadFriends();
          }
        )
        .subscribe();

      // Subscribe to when this user is removed as someone else's friend
      const friendRemovedSubscription = supabase
        .channel(`friend-removed:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'friends',
            filter: `friend_id=eq.${user.id}`
          },
          (payload) => {
            Alert.alert(
              'Friend Removed',
              'A friend has removed you from their friends list.',
              [{ text: 'OK' }]
            );
            loadFriends();
          }
        )
        .subscribe();

      // Subscribe to new messages to update unread counts
      const messagesSubscription = supabase
        .channel(`new-messages:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${user.id}`
          },
          async (payload) => {
            console.log('[FriendsListScreen] 🔔 NEW MESSAGE EVENT RECEIVED!');
            console.log('[FriendsListScreen] New message from:', payload.new.sender_id);
            console.log('[FriendsListScreen] Message ID:', payload.new.id);
            console.log('[FriendsListScreen] Message type:', payload.new.type);
            console.log('[FriendsListScreen] Full payload:', JSON.stringify(payload, null, 2));
            
            // Update unread count for the specific friend
            const senderId = payload.new.sender_id;
            
            // Get updated unread count for this friend
            const { count: unreadCount } = await supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('sender_id', senderId)
              .eq('recipient_id', user.id)
              .is('read_at', null);
            
            console.log('[FriendsListScreen] Real-time unread count for sender:', senderId, 'is:', unreadCount);
            
            // Update the specific friend's unread count
            setFriends(prevFriends => {
              console.log('[FriendsListScreen] Updating friends list with new unread count');
              const updated = prevFriends.map(friend => 
                friend.friend_id === senderId 
                  ? { ...friend, unreadCount: unreadCount || 0 }
                  : friend
              );
              console.log('[FriendsListScreen] Friends list updated via real-time event');
              return updated;
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[FriendsListScreen] Successfully subscribed to new messages channel');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Silently handle errors - realtime subscriptions can fail temporarily
            // The polling mechanism will still update the UI
            console.log('[FriendsListScreen] Channel subscription failed, falling back to polling');
          }
        });

      // Subscribe to message updates (when messages are marked as read)
      const messagesUpdateSubscription = supabase
        .channel(`message-updates:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${user.id}`
          },
          async (payload) => {
            // If message was just marked as read, update the count
            if (payload.new.read_at && !payload.old.read_at) {
              const senderId = payload.new.sender_id;
              
              // Get updated unread count for this friend
              const { count: unreadCount } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('sender_id', senderId)
                .eq('recipient_id', user.id)
                .is('read_at', null);
              
              // Update the specific friend's unread count
              setFriends(prevFriends => 
                prevFriends.map(friend => 
                  friend.friend_id === senderId 
                    ? { ...friend, unreadCount: unreadCount || 0 }
                    : friend
                )
              );
            }
          }
        )
        .subscribe();

      return () => {
        requestsSubscription.unsubscribe();
        outgoingRequestsSubscription.unsubscribe();
        friendsSubscription.unsubscribe();
        friendRemovedSubscription.unsubscribe();
        messagesSubscription.unsubscribe();
        messagesUpdateSubscription.unsubscribe();
        
        // Clear polling intervals
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        if (focusPollingInterval.current) {
          clearInterval(focusPollingInterval.current);
          focusPollingInterval.current = null;
        }
        
        // Clear notified requests when component unmounts
        notifiedRequests.current.clear();
      };
    }
  }, [user]);

  // Focus username input when Add Friend modal opens
  useEffect(() => {
    if (addFriendModalVisible) {
      // Delay slightly to ensure modal is mounted
      const t = setTimeout(() => {
        usernameInputRef.current?.focus?.();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [addFriendModalVisible]);

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

      // Get all unread messages in a single query
      const friendIds = (friendsData || []).map(f => f.friend_id);
      
      const { data: unreadMessages, error: unreadError } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('recipient_id', user.id)
        .in('sender_id', friendIds)
        .is('read_at', null);
      
      if (unreadError) {
        console.error('Error loading unread counts:', unreadError);
      }
      
      // Count messages per sender
      const unreadCounts: Record<string, number> = {};
      (unreadMessages || []).forEach(msg => {
        unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1;
      });
      
      // Get last message for each friend
      const friendsWithDetails = await Promise.all(
        (friendsData || []).map(async (friend: Friend) => {
          try {
            // Get the last message between this user and friend
            const { data: lastMessageData } = await supabase
              .from('messages')
              .select('*')
              .or(`and(sender_id.eq.${user.id},recipient_id.eq.${friend.friend_id}),and(sender_id.eq.${friend.friend_id},recipient_id.eq.${user.id})`)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            let lastMessagePreview = null;
            
            if (lastMessageData) {
              let content = '';
              
              if (lastMessageData.type === 'text' && lastMessageData.is_encrypted && lastMessageData.nonce) {
                // Decrypt the message for preview
                try {
                  const decrypted = await FriendEncryption.decryptMessage(
                    lastMessageData.content,
                    lastMessageData.nonce,
                    lastMessageData.ephemeral_public_key || '',
                    friend.friend_id,
                    user.id
                  );
                  content = decrypted || '[Encrypted message]';
                } catch (e) {
                  content = '[Encrypted message]';
                }
              } else if (lastMessageData.type === 'text') {
                content = lastMessageData.content;
              } else if (lastMessageData.type === 'voice') {
                content = '🎤 Voice message';
              }

              lastMessagePreview = {
                id: lastMessageData.id,
                type: lastMessageData.type,
                content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
                created_at: lastMessageData.created_at,
                is_mine: lastMessageData.sender_id === user.id
              };
            }

            return {
              ...friend,
              unreadCount: unreadCounts[friend.friend_id] || 0,
              lastMessage: lastMessagePreview
            };
          } catch (error) {
            console.error('Error loading last message for friend:', friend.friend_id, error);
            return {
              ...friend,
              unreadCount: unreadCounts[friend.friend_id] || 0,
              lastMessage: null
            };
          }
        })
      );

      // Sort friends by last message time (most recent first)
      const sortedFriends = friendsWithDetails.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
      });

      setFriends(sortedFriends);
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

      setPendingRequests(requests || []);
    } catch (error) {
      console.error('Error loading friend requests:', error);
      Alert.alert('Error', 'Failed to load friend requests');
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
      const { data: existingFriend, error: friendCheckError } = await supabase
        .from('friends')
        .select('id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${user.id})`)
        .maybeSingle(); // Use maybeSingle instead of single to handle no results gracefully

      console.log('[addFriend] Existing friend check:', { existingFriend, friendCheckError });

      if (existingFriend) {
        setSearchError('You are already friends with this user');
        return;
      }

      // Check if there's already any request between these users (in both directions)
      const { data: existingRequests } = await supabase
        .from('friend_requests')
        .select('id, status, from_user_id, to_user_id')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${targetUser.id}),and(from_user_id.eq.${targetUser.id},to_user_id.eq.${user.id})`);

      console.log('[addFriend] Existing requests:', existingRequests);

      if (existingRequests && existingRequests.length > 0) {
        // Delete all stale requests between these users FIRST (rejected or orphaned accepted requests)
        const staleRequests = existingRequests.filter(req => 
          req.status === 'rejected' || 
          (req.status === 'accepted' && !existingFriend) // Accepted request but no friendship = orphaned
        );
        console.log('[addFriend] Found stale requests to delete:', staleRequests.length, staleRequests.map(r => r.status));
        
        if (staleRequests.length > 0) {
          const { error: deleteError } = await supabase
            .from('friend_requests')
            .delete()
            .in('id', staleRequests.map(req => req.id));
          
          if (deleteError) {
            console.error('[addFriend] Error deleting stale requests:', deleteError);
            setSearchError('Error cleaning up old friend requests');
            return;
          } else {
            console.log('[addFriend] ✅ Successfully deleted stale requests - proceeding with new request');
            // After successful cleanup, we can proceed to create a new request
            // Skip further validation since we cleaned up the conflicts
          }
        } else {
          // Check for truly active requests only (pending status)
          const activeRequests = existingRequests.filter(req => req.status === 'pending');
          if (activeRequests.length > 0) {
            const request = activeRequests[0];
            if (request.from_user_id === user.id) {
              setSearchError('You already sent a friend request to this user');
            } else {
              setSearchError('This user already sent you a friend request - check your pending requests');
            }
            return;
          }
          
          // If we get here, there are existing requests but they're not pending
          // This could be orphaned accepted requests, so let's clean them up
          console.log('[addFriend] Found non-pending requests, cleaning up...');
          const { error: cleanupError } = await supabase
            .from('friend_requests')
            .delete()
            .in('id', existingRequests.map(req => req.id));
            
          if (cleanupError) {
            console.error('[addFriend] Error cleaning up old requests:', cleanupError);
            setSearchError('Error cleaning up old friend requests');
            return;
          } else {
            console.log('[addFriend] ✅ Cleaned up old friend requests, proceeding with new request');
          }
        }
      }

      // Send friend request using upsert to handle duplicates gracefully
      console.log('[addFriend] Sending friend request using upsert...');
      const { error: requestError } = await supabase
        .from('friend_requests')
        .upsert({
          from_user_id: user.id,
          to_user_id: targetUser.id,
          status: 'pending'
          // Only include columns that exist in the table
        }, {
          onConflict: 'from_user_id,to_user_id',
          ignoreDuplicates: false // Update existing record
        });

      if (requestError) {
        console.error('[addFriend] Upsert failed:', requestError);
        throw requestError;
      }

      console.log('[addFriend] ✅ Friend request sent successfully using upsert');

      // Send push notification to recipient
      try {
        // Get current user's username
        const { data: userData } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .single();
        
        await sendFriendRequestNotification(
          targetUser.id,
          user.id,
          userData?.username || 'Someone'
        );
      } catch (pushError: any) {
        console.error('[FriendsListScreen] Push notification failed:', pushError);
        console.error('[FriendsListScreen] Push error details:', {
          message: pushError?.message,
          error: pushError?.error,
          code: pushError?.code
        });
        // Don't fail the friend request if push fails
      }

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
      
      // Show more specific error message
      let errorMessage = 'Failed to add friend';
      
      // Check for duplicate friend request error
      if (error?.code === '23505' && error?.message?.includes('friend_requests')) {
        errorMessage = `You already have a pending friend request with ${targetUser.username}. Please wait for them to respond.`;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      Alert.alert('Friend Request Error', errorMessage);
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
              console.log('[removeFriend] Removing bidirectional friendship:', friend.friend_id);
              console.log('[removeFriend] Current user:', user.id);
              
              // Remove BOTH directions of the friendship
              const { error: friendError1, count: count1 } = await supabase
                .from('friends')
                .delete()
                .match({
                  user_id: user.id,
                  friend_id: friend.friend_id
                })
                .select();

              console.log('[removeFriend] Delete 1st direction - error:', friendError1, 'count:', count1);
              
              const { error: friendError2, count: count2 } = await supabase
                .from('friends')
                .delete()
                .match({
                  user_id: friend.friend_id,
                  friend_id: user.id
                })
                .select();

              console.log('[removeFriend] Delete 2nd direction - error:', friendError2, 'count:', count2);

              if (friendError1) throw friendError1;
              if (friendError2) throw friendError2;

              // Also clean up any friend requests between these users
              const { error: requestError } = await supabase
                .from('friend_requests')
                .delete()
                .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${friend.friend_id}),and(from_user_id.eq.${friend.friend_id},to_user_id.eq.${user.id})`);

              if (requestError) {
                console.error('Error cleaning up friend requests:', requestError);
              }

              // Update local state immediately
              setFriends(prevFriends => prevFriends.filter(f => f.friend_id !== friend.friend_id));
              
              Alert.alert('Friend Removed', `${friendName} has been removed from both friends lists.`);
              
              // Then reload from database to ensure consistency
              setTimeout(() => loadFriends(), 500);
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
      console.log('[handleFriendRequest] Processing request:', { requestId, fromUserId, accept });
      
      if (accept) {
        // Update request status to accepted
        const { error: updateError } = await supabase
          .from('friend_requests')
          .update({ 
            status: 'accepted',
            responded_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (updateError) {
          console.error('[handleFriendRequest] Error updating request:', updateError);
          throw updateError;
        }

        console.log('[handleFriendRequest] Request marked as accepted, creating bidirectional friendships...');

        // Create bidirectional friendship using batch insert with conflict handling
        const friendships = [
          { user_id: user.id, friend_id: fromUserId },
          { user_id: fromUserId, friend_id: user.id }
        ];

        for (let i = 0; i < friendships.length; i++) {
          const friendship = friendships[i];
          const direction = i === 0 ? 'user -> friend' : 'friend -> user';
          
          const { error: friendError, data: friendData } = await supabase
            .from('friends')
            .insert(friendship)
            .select()
            .single();

          if (friendError) {
            console.error(`[handleFriendRequest] Error creating ${direction} friendship:`, friendError);
            // Check if it's a duplicate key error
            if (friendError.code === '23505') {
              console.log(`[handleFriendRequest] Friendship already exists (${direction})`);
            } else {
              // If it's not a duplicate, this is a real error
              throw friendError;
            }
          } else {
            console.log(`[handleFriendRequest] Created ${direction} friendship:`, friendData);
          }
        }

        // Initialize E2E encryption for both users
        try {
          console.log('[handleFriendRequest] Initializing E2E encryption for friendship');
          // Initialize for current user using resilient method
          await FriendEncryption.initializeOrRepairFriendship(user.id, fromUserId);
          // Note: The other user will initialize their keys when they open the chat
        } catch (encryptionError) {
          console.error('[handleFriendRequest] Failed to initialize encryption:', encryptionError);
          // Don't fail the whole operation, encryption can be retried later
        }

        // Clean up the accepted friend request
        const { error: cleanupError } = await supabase
          .from('friend_requests')
          .delete()
          .eq('id', requestId);
        
        if (cleanupError) {
          console.error('[handleFriendRequest] Error cleaning up accepted request:', cleanupError);
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString();
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const friendName = item.friend?.username || item.nickname || 'Anonymous User';
    const displayName = friendName.startsWith('User ') ? 'Anonymous User' : friendName;

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
                <Ionicons name="people" size={16} color={theme.colors.text.accent} />
              )}
            </View>
            
            {item.lastMessage ? (
              <View style={styles.lastMessageContainer}>
                <Text style={styles.lastMessageText} numberOfLines={1}>
                  {item.lastMessage.is_mine && <Text style={styles.youPrefix}>You: </Text>}
                  {item.lastMessage.content}
                </Text>
                <Text style={styles.lastMessageTime}>
                  {formatTime(item.lastMessage.created_at)}
                </Text>
              </View>
            ) : item.friend?.username ? (
              <Text style={styles.friendUsername}>
                @{item.friend.username}
              </Text>
            ) : null}
          </View>
          
          {item.unreadCount && item.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </Swipeable>
    );
  };


  const styles = getStyles(theme);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[theme.typography.displaySmall, { color: theme.colors.text.primary }]}>Friends</Text>
          {pendingRequests.length > 0 && (
            <View style={styles.requestBadge}>
              <Text style={styles.requestBadgeText}>{pendingRequests.length}</Text>
            </View>
          )}
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
        ListEmptyComponent={() => (
          <EmptyState
            icon="people-outline"
            title="No Friends Yet"
            subtitle="Add friends to start chatting!"
            action={{ label: "Add Your First Friend", onPress: () => setAddFriendModalVisible(true) }}
          />
        )}
        contentContainerStyle={friends.length === 0 && pendingRequests.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Friend Modal */}
      <Modal
        visible={addFriendModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.subtle }]}>
            <Button
              variant="ghost"
              onPress={() => {
                setAddFriendModalVisible(false);
                setSearchUsername('');
                setSearchError('');
              }}
            >
              Cancel
            </Button>
            <Text style={[theme.typography.headlineMedium, { color: theme.colors.text.primary }]}>Add Friend</Text>
            <Button
              variant="ghost"
              onPress={addFriend}
              disabled={!searchUsername.trim() || isSearching}
              loading={isSearching}
            >
              Add
            </Button>
          </View>

          <View style={[styles.modalContent, { padding: theme.spacing.lg }]}>
            <Input
              label="Username"
              value={searchUsername}
              onChangeText={(text) => {
                setSearchUsername(text);
                setSearchError('');
              }}
              placeholder="Enter username"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              autoFocus
              ref={usernameInputRef}
              error={searchError}
              helperText={!searchError ? "Search for friends by their username" : undefined}
            />
            
            {user && !user.username && (
              <Card style={[{ backgroundColor: theme.colors.status.warning + '20', marginTop: theme.spacing.md }]} elevation="none">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                  <Ionicons name="information-circle" size={20} color={theme.colors.status.warning} />
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.text.primary, flex: 1 }]}>
                    Set your username in Profile to let friends find you
                  </Text>
                </View>
              </Card>
            )}
          </View>
        </SafeAreaView>
      </Modal>
      
      {/* Floating Action Menu */}
      <FloatingActionMenu
        onAddFriend={() => setAddFriendModalVisible(true)}
        onRandomChat={() => navigation.navigate('AnonymousLobby')}
        onNavigateToAnonymousChat={(conversationId, partnerId) => 
          navigation.navigate('AnonymousChat', { conversationId, partnerId })
        }
      />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg, // Increased top padding for Android safe area
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
    minHeight: theme.touchTargets.large,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.text.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  avatarText: {
    ...theme.typography.headlineMedium,
    color: theme.colors.text.inverse,
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
    ...theme.typography.bodyLarge,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  friendUsername: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMessageText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    flex: 1,
    marginRight: theme.spacing.xs,
  },
  youPrefix: {
    fontWeight: '600',
  },
  lastMessageTime: {
    ...theme.typography.labelSmall,
    color: theme.colors.text.tertiary,
  },
  emptyList: {
    flexGrow: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  modalContent: {
    flex: 1,
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
    backgroundColor: theme.colors.status.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
    flexDirection: 'column',
    paddingHorizontal: theme.spacing.lg,
  },
  deleteButtonText: {
    color: theme.colors.text.inverse,
    ...theme.typography.labelSmall,
    marginTop: theme.spacing.xs,
    fontWeight: '600',
  },
  requestsSection: {
    backgroundColor: theme.colors.status.warning + '20',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.status.warning + '40',
  },
  requestsTitle: {
    ...theme.typography.headlineSmall,
    fontWeight: '600',
    color: theme.colors.status.warning,
    marginBottom: theme.spacing.sm,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.medium,
    marginBottom: theme.spacing.xs,
  },
  requestInfo: {
    flex: 1,
  },
  requestUsername: {
    ...theme.typography.bodyLarge,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  requestTime: {
    ...theme.typography.labelSmall,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  requestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: theme.colors.background.secondary,
  },
  acceptButton: {
    backgroundColor: theme.colors.text.accent,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestBadge: {
    backgroundColor: theme.colors.status.warning,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  requestBadgeText: {
    color: theme.colors.text.inverse,
    ...theme.typography.labelSmall,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: theme.colors.text.accent,
    borderRadius: 12,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs / 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: theme.colors.text.inverse,
    ...theme.typography.labelSmall,
    fontWeight: 'bold',
  },
});
