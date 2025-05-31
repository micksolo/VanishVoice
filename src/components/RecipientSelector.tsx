import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AnonymousAuthContext';

interface Friend {
  id: string;
  friend_id: string;
  nickname?: string;
  friend?: {
    friend_code: string;
    avatar_seed: string;
  };
}

interface RecipientSelectorProps {
  selectedRecipient: string | null;
  onSelectRecipient: (recipientId: string | null, recipientName: string) => void;
}

export default function RecipientSelector({ selectedRecipient, onSelectRecipient }: RecipientSelectorProps) {
  const { user } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  useEffect(() => {
    if (user && modalVisible) {
      fetchFriends();
    }
  }, [user, modalVisible]);

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          *,
          friend:friend_id(friend_code, avatar_seed)
        `)
        .eq('user_id', user?.id);

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectRecipient = (friend: Friend | null) => {
    if (friend) {
      setSelectedFriend(friend);
      onSelectRecipient(friend.friend_id, friend.nickname || friend.friend?.friend_code || 'Friend');
    } else {
      setSelectedFriend(null);
      onSelectRecipient(null, 'Random');
    }
    setModalVisible(false);
  };

  const getAvatarColor = (seed: string = '') => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
    const index = seed.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={styles.friendItem}
      onPress={() => selectRecipient(item)}
    >
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.friend?.avatar_seed) }]}>
        <Text style={styles.avatarText}>
          {(item.nickname || item.friend?.friend_code || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {item.nickname || item.friend?.friend_code || 'Unknown'}
        </Text>
        {item.nickname && (
          <Text style={styles.friendCode}>{item.friend?.friend_code}</Text>
        )}
      </View>
      {selectedFriend?.id === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" />
      )}
    </TouchableOpacity>
  );

  const recipientDisplay = selectedFriend 
    ? (selectedFriend.nickname || selectedFriend.friend?.friend_code || 'Friend')
    : 'Select Recipient';

  return (
    <>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.selectorContent}>
          <Text style={styles.label}>Send to:</Text>
          <Text style={styles.recipient}>{recipientDisplay}</Text>
        </View>
        <Ionicons name="chevron-down" size={24} color="#666" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Recipient</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.friendItem, styles.randomOption]}
              onPress={() => selectRecipient(null)}
            >
              <View style={[styles.avatar, { backgroundColor: '#000' }]}>
                <Ionicons name="shuffle" size={24} color="#fff" />
              </View>
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>Random Connect</Text>
                <Text style={styles.friendCode}>Send to a random VanishVoice user</Text>
              </View>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator style={styles.loader} />
            ) : (
              <FlatList
                data={friends}
                renderItem={renderFriend}
                keyExtractor={(item) => item.id}
                style={styles.friendsList}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    No friends yet. Add friends to send them messages!
                  </Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  selectorContent: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  recipient: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  friendsList: {
    padding: 10,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginVertical: 5,
  },
  randomOption: {
    backgroundColor: '#f8f8f8',
    marginHorizontal: 20,
    marginTop: 10,
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
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  friendCode: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  loader: {
    padding: 50,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    padding: 50,
    fontSize: 16,
  },
});