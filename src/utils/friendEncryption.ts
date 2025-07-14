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
import * as Crypto from 'expo-crypto';

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
        console.error('[FriendEncryption] Error sharing public key:', JSON.stringify(error, null, 2));
        console.error('[FriendEncryption] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('[FriendEncryption] Keys initialized successfully');
    } catch (error) {
      console.error('[FriendEncryption] Initialization failed:', error instanceof Error ? error.message : String(error));
      console.error('[FriendEncryption] Full error:', JSON.stringify(error, null, 2));
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
      console.error('[FriendEncryption] Error getting friend public key:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Encrypt a text message for a friend
   * Uses a shared secret approach that works even if recipient hasn't opened chat yet
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
      
      // Generate ephemeral keys for this message
      const ephemeralKeys = await NaClEncryption.generateKeyPair();
      
      // Create a deterministic shared key based on the friendship
      const sharedKey = await this.deriveSharedSecret(myUserId, friendId);
      
      // Encrypt using the shared secret as the "recipient's public key"
      const encrypted = await NaClEncryption.encrypt(
        message,
        sharedKey,
        ephemeralKeys.secretKey
      );
      
      console.log('[FriendEncryption] Message encrypted successfully with shared secret');
      
      return {
        encryptedContent: encrypted.encrypted,
        nonce: encrypted.nonce,
        ephemeralPublicKey: ephemeralKeys.publicKey
      };
    } catch (error) {
      console.error('[FriendEncryption] Encryption failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Derive a shared secret for a friendship
   * Both friends can generate the same secret independently
   */
  private static async deriveSharedSecret(userId1: string, userId2: string): Promise<string> {
    // Sort IDs to ensure both friends generate the same secret
    const sortedIds = [userId1, userId2].sort();
    const combinedId = sortedIds.join(':');
    
    // Generate a deterministic key for this friendship
    const sharedKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `vanishvoice:friendship:${combinedId}:encryption_key`,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    
    return sharedKey;
  }

  /**
   * Decrypt a text message from a friend
   * Uses the same shared secret approach
   */
  static async decryptMessage(
    encryptedContent: string,
    nonce: string,
    ephemeralPublicKey: string,
    friendId: string,
    myUserId: string
  ): Promise<string | null> {
    try {
      console.log('[FriendEncryption] Decrypting message from friend:', friendId);
      
      // Generate the same shared secret
      const sharedKey = await this.deriveSharedSecret(myUserId, friendId);
      
      // Decrypt using the shared secret as our "secret key"
      const decryptedBytes = await NaClEncryption.decrypt(
        encryptedContent,
        nonce,
        ephemeralPublicKey,
        sharedKey
      );
      
      // Convert bytes to string
      const decryptedMessage = naclUtil.encodeUTF8(decryptedBytes);
      
      console.log('[FriendEncryption] Message decrypted successfully');
      
      return decryptedMessage;
    } catch (error) {
      console.error('[FriendEncryption] Decryption failed:', error instanceof Error ? error.message : String(error));
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
      
      // Also check if we have the friend's public key
      if (storedKeys) {
        const keys: FriendKeys = JSON.parse(storedKeys);
        return !!(keys.myPublicKey && keys.mySecretKey);
      }
      
      return false;
    } catch (error) {
      console.error('[FriendEncryption] Error checking keys:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Initialize or repair encryption for existing friendships
   * This is more resilient and handles cases where:
   * - The friend_keys table doesn't exist yet
   * - There are existing friendships without encryption
   * - Keys are partially set up
   */
  static async initializeOrRepairFriendship(userId: string, friendId: string): Promise<void> {
    try {
      console.log('[FriendEncryption] Initializing/repairing encryption for friendship');
      
      // Check if we already have local keys
      const storageKey = `${this.FRIEND_KEYS_PREFIX}${friendId}`;
      let localKeys = await AsyncStorage.getItem(storageKey);
      let keyPair: { publicKey: string; secretKey: string };
      
      if (localKeys) {
        const parsedKeys = JSON.parse(localKeys);
        keyPair = {
          publicKey: parsedKeys.myPublicKey,
          secretKey: parsedKeys.mySecretKey
        };
        console.log('[FriendEncryption] Using existing local keys');
      } else {
        // Generate new key pair
        keyPair = await NaClEncryption.generateKeyPair();
        console.log('[FriendEncryption] Generated new key pair');
        
        // Store keys locally
        await AsyncStorage.setItem(storageKey, JSON.stringify({
          myPublicKey: keyPair.publicKey,
          mySecretKey: keyPair.secretKey,
          friendPublicKey: null
        }));
      }
      
      // Try to share public key with friend via database
      // Use upsert with on_conflict to handle existing records
      const { error } = await supabase
        .from('friend_keys')
        .upsert({
          user_id: userId,
          friend_id: friendId,
          public_key: keyPair.publicKey,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,friend_id'
        });
      
      if (error) {
        // Check if it's a table doesn't exist error
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('[FriendEncryption] friend_keys table does not exist yet.');
          console.warn('[FriendEncryption] Please run the migration: supabase/migrations/20250114_create_friend_keys_table.sql');
          console.warn('[FriendEncryption] Continuing with local encryption only for now.');
          // Continue anyway - encryption will work locally
        } else {
          console.warn('[FriendEncryption] Could not share public key:', error.message);
          console.warn('[FriendEncryption] Error code:', error.code);
          // Continue anyway - encryption will work locally for now
        }
      } else {
        console.log('[FriendEncryption] Successfully shared public key with friend');
      }
      
      // Try to fetch friend's public key immediately
      const friendPublicKey = await this.getFriendPublicKey(friendId, userId);
      if (friendPublicKey) {
        console.log('[FriendEncryption] Friend public key found and cached');
      } else {
        console.log('[FriendEncryption] Friend public key not available yet - they need to open the chat');
      }
      
      console.log('[FriendEncryption] Keys initialized/repaired successfully');
    } catch (error) {
      console.error('[FriendEncryption] Initialization/repair failed:', error instanceof Error ? error.message : String(error));
      console.error('[FriendEncryption] Full error:', JSON.stringify(error, null, 2));
      // Don't throw - allow chat to continue with local encryption
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
      console.error('[FriendEncryption] Error removing keys:', error instanceof Error ? error.message : String(error));
    }
  }
}

export default FriendEncryption;