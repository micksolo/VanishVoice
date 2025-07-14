/**
 * Friend Message Encryption using NaCl
 * 
 * This module handles E2E encryption for friend messages using the same
 * NaCl (TweetNaCl) encryption as anonymous messages for consistency and security.
 */

import NaClEncryption from './nacl/naclEncryption';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import naclUtil from 'tweetnacl-util';

interface FriendKeys {
  myPublicKey: string;
  mySecretKey: string;
  friendPublicKey: string;
}

class FriendEncryption {
  private static FRIEND_KEYS_PREFIX = 'friend_keys_';

  /**
   * Initialize encryption keys for a new friendship
   * Called when a friend request is accepted
   */
  static async initializeFriendship(userId: string, friendId: string): Promise<void> {
    try {
      console.log('[FriendEncryption] Initializing encryption for friendship');
      
      // Generate new key pair for this friendship
      const keyPair = await NaClEncryption.generateKeyPair();
      
      // Store keys locally
      const storageKey = `${this.FRIEND_KEYS_PREFIX}${friendId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify({
        myPublicKey: keyPair.publicKey,
        mySecretKey: keyPair.secretKey,
        friendPublicKey: null // Will be set when we receive their first message
      }));
      
      // Share public key with friend via database
      const { error } = await supabase
        .from('friend_keys')
        .upsert({
          user_id: userId,
          friend_id: friendId,
          public_key: keyPair.publicKey,
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('[FriendEncryption] Error sharing public key:', error);
        throw error;
      }
      
      console.log('[FriendEncryption] Keys initialized successfully');
    } catch (error) {
      console.error('[FriendEncryption] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get friend's public key from database
   */
  static async getFriendPublicKey(friendId: string, myUserId: string): Promise<string | null> {
    try {
      // Check local cache first
      const storageKey = `${this.FRIEND_KEYS_PREFIX}${friendId}`;
      const storedKeys = await AsyncStorage.getItem(storageKey);
      
      if (storedKeys) {
        const keys: FriendKeys = JSON.parse(storedKeys);
        if (keys.friendPublicKey) {
          return keys.friendPublicKey;
        }
      }
      
      // Fetch from database
      const { data, error } = await supabase
        .from('friend_keys')
        .select('public_key')
        .eq('user_id', friendId)
        .eq('friend_id', myUserId)
        .single();
      
      if (error || !data) {
        console.log('[FriendEncryption] Friend public key not found');
        return null;
      }
      
      // Cache the friend's public key
      if (storedKeys) {
        const keys: FriendKeys = JSON.parse(storedKeys);
        keys.friendPublicKey = data.public_key;
        await AsyncStorage.setItem(storageKey, JSON.stringify(keys));
      }
      
      return data.public_key;
    } catch (error) {
      console.error('[FriendEncryption] Error getting friend public key:', error);
      return null;
    }
  }

  /**
   * Encrypt a text message for a friend
   */
  static async encryptMessage(
    message: string,
    friendId: string,
    myUserId: string
  ): Promise<{
    encryptedContent: string;
    nonce: string;
    ephemeralPublicKey: string;
  } | null> {
    try {
      console.log('[FriendEncryption] Encrypting message for friend:', friendId);
      
      // Get friend's public key
      const friendPublicKey = await this.getFriendPublicKey(friendId, myUserId);
      if (!friendPublicKey) {
        console.error('[FriendEncryption] Friend public key not available');
        return null;
      }
      
      // Get my secret key
      const storageKey = `${this.FRIEND_KEYS_PREFIX}${friendId}`;
      const storedKeys = await AsyncStorage.getItem(storageKey);
      if (!storedKeys) {
        console.error('[FriendEncryption] My keys not found');
        return null;
      }
      
      const myKeys: FriendKeys = JSON.parse(storedKeys);
      
      // Encrypt the message
      const encrypted = await NaClEncryption.encrypt(
        message,
        friendPublicKey,
        myKeys.mySecretKey
      );
      
      console.log('[FriendEncryption] Message encrypted successfully');
      
      return {
        encryptedContent: encrypted.encrypted,
        nonce: encrypted.nonce,
        ephemeralPublicKey: encrypted.ephemeralPublicKey
      };
    } catch (error) {
      console.error('[FriendEncryption] Encryption failed:', error);
      return null;
    }
  }

  /**
   * Decrypt a text message from a friend
   */
  static async decryptMessage(
    encryptedContent: string,
    nonce: string,
    ephemeralPublicKey: string,
    friendId: string
  ): Promise<string | null> {
    try {
      console.log('[FriendEncryption] Decrypting message from friend:', friendId);
      
      // Get my secret key
      const storageKey = `${this.FRIEND_KEYS_PREFIX}${friendId}`;
      const storedKeys = await AsyncStorage.getItem(storageKey);
      if (!storedKeys) {
        console.error('[FriendEncryption] My keys not found');
        return null;
      }
      
      const myKeys: FriendKeys = JSON.parse(storedKeys);
      
      // Decrypt the message
      const decryptedBytes = await NaClEncryption.decrypt(
        encryptedContent,
        nonce,
        ephemeralPublicKey,
        myKeys.mySecretKey
      );
      
      // Convert bytes to string
      const decryptedMessage = naclUtil.encodeUTF8(decryptedBytes);
      
      console.log('[FriendEncryption] Message decrypted successfully');
      
      return decryptedMessage;
    } catch (error) {
      console.error('[FriendEncryption] Decryption failed:', error);
      return null;
    }
  }

  /**
   * Check if encryption is set up for a friend
   */
  static async hasEncryptionKeys(friendId: string): Promise<boolean> {
    try {
      const storageKey = `${this.FRIEND_KEYS_PREFIX}${friendId}`;
      const storedKeys = await AsyncStorage.getItem(storageKey);
      return !!storedKeys;
    } catch (error) {
      console.error('[FriendEncryption] Error checking keys:', error);
      return false;
    }
  }

  /**
   * Clean up keys when friendship is removed
   */
  static async removeFriendKeys(friendId: string): Promise<void> {
    try {
      const storageKey = `${this.FRIEND_KEYS_PREFIX}${friendId}`;
      await AsyncStorage.removeItem(storageKey);
      console.log('[FriendEncryption] Friend keys removed');
    } catch (error) {
      console.error('[FriendEncryption] Error removing keys:', error);
    }
  }
}

export default FriendEncryption;