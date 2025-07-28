import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { useAppTheme } from '../contexts/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../services/supabase';
import { testE2EEncryption } from '../utils/testE2E';
import { testE2EDetailed } from '../utils/testE2EDetailed';
import pushNotifications from '../services/pushNotifications';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { generateRecoveryCode, saveRecoveryCode, getStoredRecoveryCode } from '../utils/recoveryCode';
import { SafeAreaView, Button, Card, IconButton, Input } from '../components/ui';
import { ThemeSelector } from '../components/ThemeSelector';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, signOut, refreshUser } = useAuth();
  const theme = useAppTheme();
  const [blockedCount, setBlockedCount] = useState(0);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [displayUsername, setDisplayUsername] = useState(user?.username);
  const [notificationStatus, setNotificationStatus] = useState<string>('undetermined');

  // Update display username when user changes
  React.useEffect(() => {
    setDisplayUsername(user?.username);
  }, [user?.username]);

  // Check notification permissions on mount
  React.useEffect(() => {
    checkNotificationPermissions();
  }, []);

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationStatus(status);
  };

  const handleNotificationToggle = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    if (existingStatus === 'denied') {
      Alert.alert(
        'Notifications Disabled',
        'Please enable notifications in your device settings to receive message alerts.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationStatus(status);
      
      if (status === 'granted' && user) {
        // Register push token
        await pushNotifications.registerForPushNotifications(user.id);
        Alert.alert('Success', 'Push notifications enabled!');
      }
    } else {
      // Already granted - show option to disable in settings
      Alert.alert(
        'Notifications Enabled',
        'To disable notifications, please go to your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
    }
  };

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
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.colors.background.secondary }}
      >
        <View style={[styles.profileHeader, { backgroundColor: theme.colors.background.primary }]}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor() }]}>
            <Text style={[styles.avatarText, { color: theme.colors.text.inverse }]}>
              {(displayUsername || user?.friend_code || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.usernameContainer}>
            <Text style={[styles.username, theme.typography.displaySmall, { color: theme.colors.text.primary }]}>{displayUsername || 'Anonymous'}</Text>
            <IconButton
              icon={<Ionicons name="pencil" size={16} color={theme.colors.text.accent} />}
              size="small"
              variant="ghost"
              onPress={() => {
                setNewUsername(displayUsername || '');
                setShowUsernameModal(true);
              }}
            />
          </View>
          <Text style={[styles.userCode, theme.typography.bodyMedium, { color: theme.colors.text.secondary, fontFamily: 'monospace' }]}>{user?.friend_code}</Text>
        </View>

        {!displayUsername && (
          <Card 
            style={[styles.usernamePromptContainer, { backgroundColor: theme.colors.status.warning + '20' }]}
            elevation="none"
          >
            <Ionicons name="information-circle" size={16} color={theme.colors.status.warning} />
            <Text style={[styles.usernamePromptText, theme.typography.bodySmall, { color: theme.colors.text.primary }]}>
              Set a username so friends can find you easily
            </Text>
          </Card>
        )}

        <Card style={[styles.friendCodeContainer, { marginTop: theme.spacing.md }]} elevation="small">
          <View style={styles.friendCodeHeader}>
            <Text style={[styles.friendCodeLabel, theme.typography.headlineSmall, { color: theme.colors.text.primary }]}>Friend Code</Text>
            <View style={styles.codeActions}>
              <IconButton
                icon={<Ionicons name="copy-outline" size={20} color={theme.colors.text.accent} />}
                onPress={copyFriendCode}
                size="small"
                variant="ghost"
              />
              <IconButton
                icon={<Ionicons name="share-outline" size={20} color={theme.colors.text.accent} />}
                onPress={shareFriendCode}
                size="small"
                variant="ghost"
              />
            </View>
          </View>
          <Text style={[styles.friendCodeHint, theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>
            Share this code with friends to connect on VanishVoice
          </Text>
        </Card>

        <ThemeSelector />
        
        <Card style={styles.settingsSection} elevation="small">
          <Text style={[styles.sectionTitle, theme.typography.overline, { color: theme.colors.text.tertiary }]}>Settings</Text>
          
          <TouchableOpacity style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]} onPress={handleNotificationToggle}>
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.status.info + '20' }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.status.info} />
            </View>
            <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Notifications</Text>
            <View style={styles.notificationStatus}>
              <Text style={[styles.notificationStatusText, theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>
                {notificationStatus === 'granted' ? 'On' : 'Off'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]}>
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.status.warning + '20' }]}>
              <Ionicons name="ban-outline" size={20} color={theme.colors.status.warning} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Blocked Users</Text>
              {blockedCount > 0 && (
                <Text style={[styles.settingBadge, theme.typography.labelSmall, { backgroundColor: theme.colors.status.error, color: theme.colors.text.inverse }]}>{blockedCount}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]}>
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.status.success + '20' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.status.success} />
            </View>
            <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Privacy</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
        </Card>

        <Card style={styles.settingsSection} elevation="small">
          <Text style={[styles.sectionTitle, theme.typography.overline, { color: theme.colors.text.tertiary }]}>Support</Text>
          
          <TouchableOpacity style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]}>
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.button.primary.background + '20' }]}>
              <Ionicons name="help-circle-outline" size={20} color={theme.colors.button.primary.background} />
            </View>
            <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Help Center</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]}>
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.text.accent + '20' }]}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.text.accent} />
            </View>
            <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>About</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
        </Card>

        {/* Debug Section - Remove in production */}
        <Card style={styles.settingsSection} elevation="small">
          <Text style={[styles.sectionTitle, theme.typography.overline, { color: theme.colors.text.tertiary }]}>Debug</Text>
          
          <TouchableOpacity 
            style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]}
            onPress={async () => {
              const result = await testE2EEncryption();
              Alert.alert('E2E Test', result ? 'Encryption working correctly!' : 'Encryption test failed!');
            }}
          >
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.status.warning + '20' }]}>
              <Ionicons name="bug-outline" size={20} color={theme.colors.status.warning} />
            </View>
            <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Test E2E Encryption</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]}
            onPress={async () => {
              const result = await testE2EDetailed();
              Alert.alert('Detailed E2E Test', result ? 'Working!' : 'Failed - check console');
            }}
          >
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.status.warning + '20' }]}>
              <Ionicons name="bug-outline" size={20} color={theme.colors.status.warning} />
            </View>
            <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Detailed E2E Test</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]}
            onPress={async () => {
              await pushNotifications.scheduleLocalNotification(
                'Test Notification',
                'Push notifications are working!',
                { test: true }
              );
              Alert.alert('Success', 'Test notification scheduled!');
            }}
          >
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.status.info + '20' }]}>
              <Ionicons name="notifications" size={20} color={theme.colors.status.info} />
            </View>
            <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Test Push Notification</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]}
            onPress={async () => {
              const { verifyE2EEncryption } = await import('../utils/verifyE2EEncryption');
              await verifyE2EEncryption(true);
            }}
          >
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.status.success + '20' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.status.success} />
            </View>
            <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Verify Voice E2E Encryption</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]}
            onPress={() => navigation.navigate('ThemeDemo' as never)}
          >
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.button.primary.background + '20' }]}>
              <Ionicons name="color-palette-outline" size={20} color={theme.colors.button.primary.background} />
            </View>
            <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Theme Demo</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.settingItem, { minHeight: theme.touchTargets.medium }]}
            onPress={() => navigation.navigate('EphemeralDemo' as never)}
          >
            <View style={[styles.settingIcon, { backgroundColor: theme.colors.button.primary.background + '20' }]}>
              <Ionicons name="sparkles-outline" size={20} color={theme.colors.button.primary.background} />
            </View>
            <Text style={[styles.settingText, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>Ephemeral Demo</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
        </Card>

        <Button
          variant="danger"
          onPress={handleSignOut}
          icon={<Ionicons name="log-out-outline" size={20} color={theme.colors.button.danger.text} />}
          style={styles.signOutButton}
        >
          Sign Out
        </Button>
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
              style={[styles.modalContent, { backgroundColor: theme.colors.background.primary }]} 
              activeOpacity={1}
              onPress={() => {}}
            >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, theme.typography.displaySmall, { color: theme.colors.text.primary }]}>Edit Username</Text>
              <IconButton
                icon={<Ionicons name="close" size={24} color={theme.colors.text.secondary} />}
                onPress={() => {
                  setShowUsernameModal(false);
                  setNewUsername('');
                  setUsernameError('');
                  Keyboard.dismiss();
                }}
                size="medium"
                variant="ghost"
              />
            </View>

            <Input
              label="Username"
              value={newUsername}
              onChangeText={(text) => {
                setNewUsername(text);
                validateUsername(text);
              }}
              placeholder="Enter username"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              error={usernameError}
              helperText={newUsername.trim() && !usernameError ? `${20 - newUsername.length} characters remaining` : undefined}
            />
            <Text style={[styles.rulesText, theme.typography.bodySmall, { color: theme.colors.text.tertiary }]}>
              • 3-20 characters{'\n'}
              • Letters, numbers, and underscores only{'\n'}
              • Leave empty to remain anonymous
            </Text>

            <View style={styles.modalButtons}>
              <Button
                variant="secondary"
                onPress={() => {
                  setShowUsernameModal(false);
                  setNewUsername('');
                  setUsernameError('');
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              
              <Button
                variant="primary"
                onPress={saveUsername}
                disabled={isSaving || isCheckingUsername || !!usernameError}
                loading={isSaving}
                style={{ flex: 1 }}
              >
                Save
              </Button>
            </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
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
  },
  username: {
    // Using theme typography
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  userCode: {
    // Using theme typography
  },
  usernamePromptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 20,
    gap: 8,
  },
  usernamePromptText: {
    flex: 1,
  },
  friendCodeContainer: {
    marginHorizontal: 20,
  },
  friendCodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  friendCodeLabel: {
    // Using theme typography
  },
  codeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  friendCodeHint: {
    // Using theme typography
  },
  settingsSection: {
    marginTop: 24,
    marginHorizontal: 20,
  },
  sectionTitle: {
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
  },
  settingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
    overflow: 'hidden',
  },
  signOutButton: {
    marginVertical: 32,
    marginHorizontal: 20,
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
    // Using theme typography
  },
  rulesText: {
    lineHeight: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  // Modal button styles now handled by Button component
  notificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationStatusText: {
    // Using theme typography
  },
});