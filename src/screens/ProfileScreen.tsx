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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import * as Clipboard from 'expo-clipboard';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [blockedCount, setBlockedCount] = useState(0);

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor() }]}>
            <Text style={styles.avatarText}>
              {(user?.friend_code || '?')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.username}>Anonymous</Text>
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

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
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
    marginBottom: 4,
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
});