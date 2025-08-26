import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme';
import { supabase } from '../services/supabase';

interface Friend {
  id: string;
  friend_id: string;
  created_at: string;
  friend?: {
    friend_code: string;
  };
}

export default function FriendsScreen() {
  const { user } = useAuth();
  const theme = useAppTheme();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [friendCode, setFriendCode] = useState('');

  useEffect(() => {
    if (user) {
      fetchFriends();
    }
  }, [user]);

  const fetchFriends = async () => {
    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          *,
          friend:friend_id(friend_code)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
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
      fetchFriends();
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend');
    }
  };

  const removeFriend = async (friendId: string) => {
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('friends')
                .delete()
                .eq('user_id', user?.id)
                .eq('friend_id', friendId);

              if (error) throw error;
              fetchFriends();
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  const styles = getStyles(theme);

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <View style={styles.friendIcon}>
        <Ionicons name="person-circle-outline" size={40} color={theme.colors.text.primary} />
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendCode}>{item.friend?.friend_code}</Text>
        <Text style={styles.friendDate}>
          Added {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => removeFriend(item.friend_id)}
        style={styles.removeButton}
      >
        <Ionicons name="trash-outline" size={20} color={theme.colors.feedback.error} />
      </TouchableOpacity>
    </View>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={80} color={theme.colors.text.tertiary} />
      <Text style={styles.emptyText}>No friends yet</Text>
      <Text style={styles.emptySubtext}>
        Add friends using their friend code
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={(item) => item.id}
        contentContainerStyle={friends.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={EmptyState}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="person-add" size={24} color={theme.colors.text.inverse} />
      </TouchableOpacity>

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
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface.primary,
  },
  emptyContainer: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface.secondary,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.sm,
    marginVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.small,
  },
  friendIcon: {
    marginRight: theme.spacing.md,
  },
  friendInfo: {
    flex: 1,
  },
  friendCode: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  friendDate: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  removeButton: {
    padding: theme.spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  emptyText: {
    ...theme.typography.headlineLarge,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.lg,
  },
  emptySubtext: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.large,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.overlay.dark,
  },
  modalContent: {
    backgroundColor: theme.colors.surface.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '80%',
    ...theme.shadows.large,
  },
  modalTitle: {
    ...theme.typography.headlineLarge,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.surface.primary,
    marginBottom: theme.spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surface.tertiary,
    marginRight: theme.spacing.sm,
  },
  addButton: {
    backgroundColor: theme.colors.primary.main,
    marginLeft: theme.spacing.sm,
  },
  cancelButtonText: {
    color: theme.colors.text.primary,
    ...theme.typography.button.medium,
  },
  addButtonText: {
    color: theme.colors.text.inverse,
    ...theme.typography.button.medium,
  },
});