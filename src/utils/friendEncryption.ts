/**
 * Zero-Knowledge Friend Message Encryption
 * 
 * This module provides true zero-knowledge E2E encryption for friend messages.
 * The server CANNOT decrypt any messages because it never has access to private keys.
 * 
 * SECURITY MODEL:
 * - Each device has unique keypair stored in secure hardware
 * - Private keys NEVER leave the device
 * - Public keys stored in database for key exchange
 * - Uses nacl.box (Curve25519 + XSalsa20 + Poly1305)
 * - Perfect Forward Secrecy via ephemeral keys
 */

import NaClBoxEncryption from './NaClBoxEncryption';
import SecureDeviceKeys, { DeviceKeyPair } from './SecureDeviceKeys';
import { supabase } from '../services/supabase';

class FriendEncryption {
  private static deviceKeys: DeviceKeyPair | null = null;

  /**
   * Initialize device keys and publish public key
   * Called on app startup or user login
   */
  static async initializeDevice(userId: string): Promise<void> {
    try {
      console.log('[FriendEncryption] Initializing device keys...');
      
      // Get or generate device keys
      this.deviceKeys = await SecureDeviceKeys.initializeDeviceKeys();
      
      // Publish public key to database
      await SecureDeviceKeys.publishPublicKey(userId, this.deviceKeys);
      
      console.log('[FriendEncryption] Device initialization complete');
      if (__DEV__) {
        console.log('[FriendEncryption] Device initialized: [DEVICE_ID_REDACTED]');
      }
      console.log(`[FriendEncryption] Public key ready`);
    } catch (error) {
      console.error('[FriendEncryption] Device initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize encryption for a new friendship
   * This just ensures device keys are ready - no per-friendship setup needed
   */
  static async initializeFriendship(userId: string, friendId: string): Promise<void> {
    try {
      console.log('[FriendEncryption] Initializing encryption for friendship');
      
      // Ensure device keys are initialized
      if (!this.deviceKeys) {
        await this.initializeDevice(userId);
      }
      
      // Check if friend has published their public key
      const friendPublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(friendId);
      if (friendPublicKey) {
        console.log('[FriendEncryption] Friend public key found, ready for secure messaging');
      } else {
        console.log('[FriendEncryption] Friend public key not found, they need to open the app first');
      }
      
      console.log('[FriendEncryption] Friendship encryption initialized successfully');
    } catch (error) {
      console.error('[FriendEncryption] Friendship initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get friend's public key from database
   */
  static async getFriendPublicKey(friendId: string, myUserId: string): Promise<string | null> {
    try {
      // Get the latest public key for the friend
      const publicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(friendId);
      
      if (!publicKey) {
        console.log('[FriendEncryption] Friend public key not found - they may not have opened the app yet');
        return null;
      }
      
      return publicKey;
    } catch (error) {
      console.error('[FriendEncryption] Error getting friend public key:', error);
      return null;
    }
  }

  /**
   * Encrypt a text message for a friend using zero-knowledge encryption
   * Server CANNOT decrypt this message because it doesn't have private keys
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
      if (__DEV__) {
        console.log('[FriendEncryption] Encrypting message for friend: [USER_ID_REDACTED]');
      }
      
      // Ensure device keys are available
      if (!this.deviceKeys) {
        await this.initializeDevice(myUserId);
      }
      
      // Get friend's public key
      const friendPublicKey = await this.getFriendPublicKey(friendId, myUserId);
      if (!friendPublicKey) {
        throw new Error('Friend public key not available - they need to open the app first');
      }
      
      // Encrypt using nacl.box with our device private key
      const encrypted = await NaClBoxEncryption.encrypt(
        message,
        friendPublicKey,
        this.deviceKeys!.privateKey
      );
      
      console.log('[FriendEncryption] Message encrypted successfully with zero-knowledge encryption');
      console.log('[FriendEncryption] Server CANNOT decrypt this message');
      
      return {
        encryptedContent: encrypted.encryptedContent,
        nonce: encrypted.nonce,
        ephemeralPublicKey: encrypted.ephemeralPublicKey
      };
    } catch (error) {
      console.error('[FriendEncryption] Zero-knowledge encryption failed:', error);
      return null;
    }
  }

  /**
   * Decrypt a text message from a friend using zero-knowledge decryption
   * Only this device can decrypt because it has the private key
   */
  static async decryptMessage(
    encryptedContent: string,
    nonce: string,
    ephemeralPublicKey: string,
    friendId: string,
    myUserId: string
  ): Promise<string | null> {
    try {
      if (__DEV__) {
        console.log('[FriendEncryption] Decrypting message from friend: [USER_ID_REDACTED]');
      }
      
      // Ensure device keys are available
      if (!this.deviceKeys) {
        await this.initializeDevice(myUserId);
      }
      
      // Decrypt using nacl.box.open with our device private key
      const decryptedMessage = await NaClBoxEncryption.decryptToString(
        encryptedContent,
        nonce,
        ephemeralPublicKey,
        this.deviceKeys!.privateKey
      );
      
      console.log('[FriendEncryption] Message decrypted successfully with zero-knowledge decryption');
      
      return decryptedMessage;
    } catch (error) {
      console.error('[FriendEncryption] Zero-knowledge decryption failed:', error);
      return null;
    }
  }

  /**
   * Check if encryption is set up for a friend
   */
  static async hasEncryptionKeys(friendId: string): Promise<boolean> {
    try {
      // Check if we have our device keys
      if (!this.deviceKeys) {
        const deviceKeys = await SecureDeviceKeys.getDeviceKeys();
        if (!deviceKeys) {
          return false;
        }
        this.deviceKeys = deviceKeys;
      }
      
      // Check if friend has published their public key
      const friendPublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(friendId);
      
      return !!(this.deviceKeys && friendPublicKey);
    } catch (error) {
      console.error('[FriendEncryption] Error checking encryption keys:', error);
      return false;
    }
  }

  /**
   * Initialize or repair encryption for existing friendships
   * Ensures device keys are set up and published
   */
  static async initializeOrRepairFriendship(userId: string, friendId: string): Promise<void> {
    try {
      console.log('[FriendEncryption] Initializing/repairing zero-knowledge encryption for friendship');
      
      // Ensure device keys are initialized
      if (!this.deviceKeys) {
        await this.initializeDevice(userId);
      }
      
      // Check if friend has published their public key
      const friendPublicKey = await this.getFriendPublicKey(friendId, userId);
      if (friendPublicKey) {
        console.log('[FriendEncryption] Friend public key found, ready for secure messaging');
      } else {
        console.log('[FriendEncryption] Friend public key not available yet - they need to open the app first');
      }
      
      console.log('[FriendEncryption] Zero-knowledge encryption initialized/repaired successfully');
    } catch (error) {
      console.error('[FriendEncryption] Zero-knowledge initialization/repair failed:', error);
      // Don't throw - allow chat to continue and retry later
    }
  }

  /**
   * Clean up keys when friendship is removed
   * Note: We keep device keys since they're used for all friendships
   */
  static async removeFriendKeys(friendId: string): Promise<void> {
    try {
      // In zero-knowledge system, we don't store per-friend keys
      // Device keys are shared across all friendships
      console.log('[FriendEncryption] Friend cleanup complete (zero-knowledge system uses shared device keys)');
    } catch (error) {
      console.error('[FriendEncryption] Error in friend cleanup:', error);
    }
  }

  /**
   * Get current device keys (for debugging/verification)
   */
  static async getDeviceKeys(): Promise<DeviceKeyPair | null> {
    return this.deviceKeys || await SecureDeviceKeys.getDeviceKeys();
  }

  /**
   * Run encryption verification test
   */
  static async verifyEncryption(): Promise<boolean> {
    try {
      console.log('[FriendEncryption] Running zero-knowledge encryption verification...');
      
      const verified = await NaClBoxEncryption.verifyEncryption();
      
      if (verified) {
        console.log('[FriendEncryption] ✅ Zero-knowledge encryption verified successfully!');
        console.log('[FriendEncryption] ✅ Server CANNOT decrypt any messages!');
      } else {
        console.error('[FriendEncryption] ❌ Zero-knowledge encryption verification FAILED!');
      }
      
      return verified;
    } catch (error) {
      console.error('[FriendEncryption] Zero-knowledge encryption verification error:', error);
      return false;
    }
  }

  /**
   * Clear device keys (for logout)
   */
  static async clearDeviceKeys(): Promise<void> {
    try {
      await SecureDeviceKeys.clearDeviceKeys();
      this.deviceKeys = null;
      console.log('[FriendEncryption] Device keys cleared');
    } catch (error) {
      console.error('[FriendEncryption] Error clearing device keys:', error);
      throw error;
    }
  }
}

export default FriendEncryption;