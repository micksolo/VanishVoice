import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Share,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../services/supabase';
import { testE2EEncryption } from '../utils/testE2E';

export default function ProfileScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const [blockedCount, setBlockedCount] = useState(0);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [displayUsername, setDisplayUsername] = useState(user?.username);

  // Update display username when user changes
  React.useEffect(() => {
    setDisplayUsername(user?.username);
  }, [user?.username]);

  const getAvatarColor = () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
    const index = (user?.friend_code?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  const copyFriendCode = async () => {
    if (user?.friend_code) {
      await Clipboard.setStringAsync(user.friend_code);
      Alert.alert('Copied!', 'Friend code copied to clipboard');
    }
  };

  const shareFriendCode = async () => {
    if (user?.friend_code) {
      try {
        await Share.share({
          message: `Add me on VanishVoice! My friend code is: ${user.friend_code}`,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

  const validateUsername = (username: string) => {
    if (!username.trim()) {
      setUsernameError('');
      return true; // Empty is valid (removes username)
    }
    
    if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return false;
    }
    
    if (username.length > 20) {
      setUsernameError('Username must be 20 characters or less');
      return false;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return false;
    }
    
    setUsernameError('');
    return true;
  };

  const checkUsernameAvailable = async (username: string) => {
    if (!username.trim() || username.toLowerCase() === displayUsername?.toLowerCase()) {
      return true;
    }

    setIsCheckingUsername(true);
    try {
      // Check if username is already taken by querying users table directly
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('id')
        .ilike('username', username)
        .neq('id', user?.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }
      
      if (existingUser) {
        setUsernameError('Username is already taken');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking username:', error);
      // In case of error, let the user try anyway
      return true;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const saveUsername = async () => {
    const trimmedUsername = newUsername.trim();
    
    if (!validateUsername(trimmedUsername)) {
      return;
    }

    const isAvailable = await checkUsernameAvailable(trimmedUsername);
    if (!isAvailable) {
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          username: trimmedUsername || null // Set to null if empty
        })
        .eq('id', user?.id);

      if (error) throw error;

      // Update display immediately
      setDisplayUsername(trimmedUsername || undefined);
      
      Alert.alert('Success', 'Username updated successfully');
      setShowUsernameModal(false);
      
      // Refresh user data in context
      await refreshUser();
    } catch (error) {
      console.error('Error saving username:', error);
      Alert.alert('Error', 'Failed to update username');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor() }]}>
            <Text style={styles.avatarText}>
              {(displayUsername || user?.friend_code || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.usernameContainer}>
            <Text style={styles.username}>{displayUsername || 'Anonymous'}</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setNewUsername(displayUsername || '');
                setShowUsernameModal(true);
              }}
            >
              <Ionicons name="pencil" size={16} color="#4ECDC4" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userCode}>{user?.friend_code}</Text>
        </View>

        <View style={styles.friendCodeContainer}>
          <View style={styles.friendCodeHeader}>
            <Text style={styles.friendCodeLabel}>Friend Code</Text>
            <View style={styles.codeActions}>
              <TouchableOpacity onPress={copyFriendCode} style={styles.codeAction}>
                <Ionicons name="copy-outline" size={20} color="#4ECDC4" />
              </TouchableOpacity>
              <TouchableOpacity onPress={shareFriendCode} style={styles.codeAction}>
                <Ionicons name="share-outline" size={20} color="#4ECDC4" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.friendCodeHint}>
            Share this code with friends to connect on VanishVoice
          </Text>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#F0F9FF' }]}>
              <Ionicons name="notifications-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.settingText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="ban-outline" size={20} color="#F97316" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingText}>Blocked Users</Text>
              {blockedCount > 0 && (
                <Text style={styles.settingBadge}>{blockedCount}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#22C55E" />
            </View>
            <Text style={styles.settingText}>Privacy</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="help-circle-outline" size={20} color="#6366F1" />
            </View>
            <Text style={styles.settingText}>Help Center</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="information-circle-outline" size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.settingText}>About</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Debug Section - Remove in production */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Debug</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={async () => {
              const result = await testE2EEncryption();
              Alert.alert('E2E Test', result ? 'Encryption working correctly!' : 'Encryption test failed!');
            }}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="bug-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.settingText}>Test E2E Encryption</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Username Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showUsernameModal}
        onRequestClose={() => setShowUsernameModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => {
              setShowUsernameModal(false);
              setNewUsername('');
              setUsernameError('');
              Keyboard.dismiss();
            }}
          >
            <TouchableOpacity 
              style={styles.modalContent} 
              activeOpacity={1}
              onPress={() => {}}
            >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Username</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowUsernameModal(false);
                  setNewUsername('');
                  setUsernameError('');
                  Keyboard.dismiss();
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={[styles.input, usernameError ? styles.inputError : null]}
              value={newUsername}
              onChangeText={(text) => {
                setNewUsername(text);
                validateUsername(text);
              }}
              placeholder="Enter username"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            
            {usernameError ? (
              <Text style={styles.errorText}>{usernameError}</Text>
            ) : newUsername.trim() ? (
              <Text style={styles.helperText}>
                {20 - newUsername.length} characters remaining
              </Text>
            ) : null}

            <Text style={styles.rulesText}>
              • 3-20 characters{'\n'}
              • Letters, numbers, and underscores only{'\n'}
              • Leave empty to remain anonymous
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowUsernameModal(false);
                  setNewUsername('');
                  setUsernameError('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.saveButton,
                  (isSaving || isCheckingUsername) && styles.disabledButton
                ]}
                onPress={saveUsername}
                disabled={isSaving || isCheckingUsername || !!usernameError}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  editButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F0FFFE',
  },
  userCode: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'monospace',
  },
  friendCodeContainer: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
  },
  friendCodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  friendCodeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  codeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  codeAction: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0FFFE',
  },
  friendCodeHint: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  settingsSection: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  settingBadge: {
    backgroundColor: '#EF4444',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 32,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  signOutText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    minHeight: 380,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 6,
  },
  helperText: {
    color: '#666',
    fontSize: 14,
    marginTop: 6,
  },
  rulesText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  saveButton: {
    backgroundColor: '#1A1A1A',
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});