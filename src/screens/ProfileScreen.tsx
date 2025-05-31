import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import * as Clipboard from 'expo-clipboard';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

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
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person-circle" size={100} color="#000" />
        </View>
        <Text style={styles.anonId}>Anonymous User</Text>
      </View>

      <View style={styles.friendCodeContainer}>
        <Text style={styles.friendCodeLabel}>Your Friend Code</Text>
        <View style={styles.friendCodeBox}>
          <Text style={styles.friendCode}>{user?.friend_code}</Text>
          <TouchableOpacity onPress={copyFriendCode} style={styles.iconButton}>
            <Ionicons name="copy-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={shareFriendCode} style={styles.iconButton}>
            <Ionicons name="share-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>
        <Text style={styles.friendCodeHint}>
          Share this code with friends to connect
        </Text>
      </View>

      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="notifications-outline" size={24} color="#000" />
          <Text style={styles.settingText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#000" />
          <Text style={styles.settingText}>Privacy</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="help-circle-outline" size={24} color="#000" />
          <Text style={styles.settingText}>Help</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="information-circle-outline" size={24} color="#000" />
          <Text style={styles.settingText}>About</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={24} color="#ff3b30" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
  },
  avatar: {
    marginBottom: 10,
  },
  anonId: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  friendCodeContainer: {
    backgroundColor: '#fff',
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  friendCodeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  friendCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 10,
  },
  friendCode: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  iconButton: {
    marginLeft: 10,
    padding: 5,
  },
  friendCodeHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 10,
  },
  settingsSection: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  settingText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
  },
  signOutText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#ff3b30',
  },
});