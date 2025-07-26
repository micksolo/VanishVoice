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
import { useAppTheme } from '../contexts/ThemeContext';
import { Card, IconButton, Loading } from './ui';

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
  const theme = useAppTheme();
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
        <Text style={[styles.avatarText, { color: theme.colors.text.inverse }]}>
          {(item.nickname || item.friend?.friend_code || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={[styles.friendName, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>
          {item.nickname || item.friend?.friend_code || 'Unknown'}
        </Text>
        {item.nickname && (
          <Text style={[styles.friendCode, theme.typography.bodySmall, { color: theme.colors.text.secondary }]}>{item.friend?.friend_code}</Text>
        )}
      </View>
      {selectedFriend?.id === item.id && (
        <Ionicons name="checkmark-circle" size={24} color={theme.colors.text.accent} />
      )}
    </TouchableOpacity>
  );

  const recipientDisplay = selectedFriend 
    ? (selectedFriend.nickname || selectedFriend.friend?.friend_code || 'Friend')
    : 'Select Recipient';

  return (
    <>
      <Card
        pressable
        onPress={() => setModalVisible(true)}
        style={styles.selector}
        elevation="small"
      >
        <View style={styles.selectorContent}>
          <Text style={[styles.label, theme.typography.labelSmall, { color: theme.colors.text.secondary }]}>Send to:</Text>
          <Text style={[styles.recipient, theme.typography.headlineSmall, { color: theme.colors.text.primary }]}>{recipientDisplay}</Text>
        </View>
        <Ionicons name="chevron-down" size={24} color={theme.colors.text.tertiary} />
      </Card>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background.primary }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border.subtle }]}>
              <Text style={[styles.modalTitle, theme.typography.headlineMedium, { color: theme.colors.text.primary }]}>Select Recipient</Text>
              <IconButton
                icon={<Ionicons name="close" size={24} color={theme.colors.text.primary} />}
                onPress={() => setModalVisible(false)}
                size="medium"
                variant="ghost"
              />
            </View>

            <TouchableOpacity
              style={[styles.friendItem, styles.randomOption, { backgroundColor: theme.colors.background.secondary }]}
              onPress={() => selectRecipient(null)}
            >
              <View style={[styles.avatar, { backgroundColor: theme.colors.text.primary }]}>
                <Ionicons name="shuffle" size={24} color={theme.colors.text.inverse} />
              </View>
              <View style={styles.friendInfo}>
                <Text style={[styles.friendName, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Random Connect</Text>
                <Text style={[styles.friendCode, theme.typography.bodySmall, { color: theme.colors.text.secondary }]}>Send to a random VanishVoice user</Text>
              </View>
            </TouchableOpacity>

            {loading ? (
              <Loading size="large" style={styles.loader} />
            ) : (
              <FlatList
                data={friends}
                renderItem={renderFriend}
                keyExtractor={(item) => item.id}
                style={styles.friendsList}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>
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
    marginBottom: 20,
  },
  selectorContent: {
    flex: 1,
  },
  label: {
    marginBottom: 2,
  },
  recipient: {
    // Using theme typography
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
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
  },
  modalTitle: {
    // Using theme typography
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
    minHeight: 60, // Ensure minimum touch target
  },
  randomOption: {
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
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    // Using theme typography
  },
  friendCode: {
    marginTop: 2,
  },
  loader: {
    padding: 50,
  },
  emptyText: {
    textAlign: 'center',
    padding: 50,
  },
});