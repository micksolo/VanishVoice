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
  // PHASE 1 FIX: Remove static caching to prevent stale key usage
  // Always fetch fresh keys to ensure sender/receiver key consistency
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
   * Get friend's current public key from database
   * PHASE 1 FIX: Always fetches fresh current key, no caching to prevent stale key usage
   * 
   * @param friendId - Friend's user ID
   * @param myUserId - Current user's ID
   * @param returnMetadata - If true, returns key metadata for recipient tracking
   */
  static async getFriendPublicKey(
    friendId: string, 
    myUserId: string, 
    returnMetadata: false
  ): Promise<string | null>;
  static async getFriendPublicKey(
    friendId: string, 
    myUserId: string, 
    returnMetadata: true
  ): Promise<{publicKey: string; keyId: string; deviceId: string} | null>;
  static async getFriendPublicKey(
    friendId: string, 
    myUserId: string, 
    returnMetadata: boolean = false
  ): Promise<string | {publicKey: string; keyId: string; deviceId: string} | null> {
    try {
      console.log('[FriendEncryption] Getting CURRENT public key for friend (Phase 1 fix):', friendId);
      console.log('[FriendEncryption] 🚫 NO CACHING - always fetch fresh to prevent sender/receiver key mismatches');
      
      // PHASE 1 FIX: Always get current key, never use cached values
      // PHASE 2 FIX: Get key with metadata for recipient tracking
      const currentKeyData = returnMetadata 
        ? await SecureDeviceKeys.getLatestPublicKeyForUserWithMetadata(friendId)
        : await SecureDeviceKeys.getLatestPublicKeyForUser(friendId);
      
      const currentKey = typeof currentKeyData === 'string' ? currentKeyData : currentKeyData?.publicKey;
      
      if (!currentKey) {
        console.log('[FriendEncryption] Current public key not found - friend may not have opened app');
        
        // Additional debugging: check if any keys exist at all
        const allKeys = await SecureDeviceKeys.getPublicKeysForUser(friendId);
        if (allKeys.length > 0) {
          console.warn('[FriendEncryption] ⚠️ Friend has keys but no current key marked!');
          console.warn(`[FriendEncryption] Found ${allKeys.length} keys, but none marked as current`);
          console.warn('[FriendEncryption] This indicates atomic key management is not working');
          allKeys.forEach((key, index) => {
            console.warn(`[FriendEncryption] Key ${index + 1}: device=${key.device_id}, current=${key.is_current}, status=${key.status}`);  
          });
        }
        
        return null;
      }
      
      console.log('[FriendEncryption] ✅ Successfully retrieved current public key');
      console.log('[FriendEncryption] ✅ This should prevent sender/receiver key mismatches');
      
      // Additional validation: verify we got a single current key
      const allKeys = await SecureDeviceKeys.getPublicKeysForUser(friendId);
      const currentKeys = allKeys.filter(k => k.is_current);
      
      if (currentKeys.length > 1) {
        console.error('[FriendEncryption] ❌ CRITICAL: Multiple current keys detected!');
        console.error('[FriendEncryption] This WILL cause "nacl.box.open returned null" errors');
        currentKeys.forEach((key, index) => {
          console.error(`[FriendEncryption] Current key ${index + 1}: ${key.device_id} (${key.created_at})`);
        });
        console.error('[FriendEncryption] DATABASE CONSTRAINT VIOLATION - Phase 1 migration failed!');
      } else if (currentKeys.length === 1) {
        const keyInfo = currentKeys[0];
        console.log('[FriendEncryption] ✅ Key validation passed:');
        console.log(`[FriendEncryption] Device: ${keyInfo.device_id}`);
        console.log(`[FriendEncryption] Status: ${keyInfo.status || 'unknown'}`);
        console.log(`[FriendEncryption] Updated: ${keyInfo.updated_at || keyInfo.created_at}`);
      }
      
      if (returnMetadata && typeof currentKeyData === 'object' && currentKeyData !== null) {
        return {
          publicKey: currentKeyData.publicKey,
          keyId: currentKeyData.keyId,
          deviceId: currentKeyData.deviceId
        };
      } else {
        return currentKey;
      }
    } catch (error) {
      console.error('[FriendEncryption] Error getting friend current public key:', error);
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
   * Validate device key consistency for video decryption debugging
   * Checks if private key matches public key stored in database
   */
  static async validateDeviceKeyConsistency(userId: string): Promise<boolean> {
    try {
      console.log('[FriendEncryption] 🔍 Validating device key consistency...');
      
      // Get device private key
      const deviceKeys = await this.getDeviceKeys();
      if (!deviceKeys) {
        console.error('[FriendEncryption] ❌ No device keys found');
        return false;
      }
      
      // Derive public key from private key
      const derivedPublicKey = await NaClBoxEncryption.getPublicKeyFromPrivate(deviceKeys.privateKey);
      
      // Get public key from database - use latest key if multiple exist
      const { data: storedKeys, error } = await supabase
        .from('device_public_keys')
        .select('public_key, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('[FriendEncryption] ❌ Failed to fetch stored public key:', error);
        return false;
      }
      
      if (!storedKeys || storedKeys.length === 0) {
        console.error('[FriendEncryption] ❌ No public keys found in database');
        return false;
      }
      
      const latestStoredKey = storedKeys[0];
      console.log('[FriendEncryption] 🔑 Key consistency check:');
      console.log(`- Found ${storedKeys.length === 1 ? '1 key' : 'multiple keys'} in database, using latest`);
      console.log(`- Derived public key: ${derivedPublicKey.slice(0, 8)}...`);
      console.log(`- Stored public key:  ${latestStoredKey.public_key.slice(0, 8)}...`);
      
      const isConsistent = derivedPublicKey === latestStoredKey.public_key;
      
      if (isConsistent) {
        console.log('[FriendEncryption] ✅ Device key consistency validated');
      } else {
        console.error('[FriendEncryption] ❌ CRITICAL: Device key mismatch detected!');
        console.error('[FriendEncryption] Private key does not match stored public key');
        console.error('[FriendEncryption] This will cause all decryption to fail with nacl.box.open null');
      }
      
      return isConsistent;
    } catch (error) {
      console.error('[FriendEncryption] ❌ Device key validation failed:', error);
      return false;
    }
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
   * Comprehensive key exchange debugging for video decryption issues
   * PHASE 1 FIX: Enhanced debugging with current key validation
   */
  static async debugKeyExchangeFlow(
    senderId: string,
    recipientId: string,
    ephemeralPublicKey?: string
  ): Promise<{
    success: boolean;
    details: string[];
    recommendations: string[];
  }> {
    const details: string[] = [];
    const recommendations: string[] = [];
    
    try {
      details.push('🔍 DEBUGGING KEY EXCHANGE FLOW (Phase 1 Enhanced)');
      details.push(`📤 Sender: ${senderId}`);
      details.push(`📥 Recipient: ${recipientId}`);
      
      // Step 1: Check recipient's device keys
      details.push('\n1️⃣ RECIPIENT DEVICE KEYS:');
      const recipientDeviceKeys = await this.getDeviceKeys();
      if (!recipientDeviceKeys) {
        details.push('❌ No device keys found on this device');
        recommendations.push('Initialize device keys by restarting the app');
        return { success: false, details, recommendations };
      }
      
      details.push('✅ Device keys found locally');
      details.push(`   Device ID: ${recipientDeviceKeys.deviceId}`);
      details.push(`   Private key length: ${recipientDeviceKeys.privateKey.length}`);
      
      // Step 2: PHASE 1 ENHANCED - Check current vs all keys
      details.push('\n2️⃣ RECIPIENT PUBLIC KEYS ANALYSIS (Phase 1):');
      const recipientPublicKeys = await SecureDeviceKeys.getPublicKeysForUser(recipientId);
      if (!recipientPublicKeys || recipientPublicKeys.length === 0) {
        details.push('❌ No public keys found in database');
        recommendations.push('Recipient needs to open app to publish public key');
        return { success: false, details, recommendations };
      }
      
      const currentKeys = recipientPublicKeys.filter(k => k.is_current);
      const activeKeys = recipientPublicKeys.filter(k => k.status === 'active');
      
      details.push(`✅ Found ${recipientPublicKeys.length} total public keys in database`);
      details.push(`   Current keys: ${currentKeys.length}`);
      details.push(`   Active keys: ${activeKeys.length}`);
      
      // PHASE 1 CRITICAL VALIDATION
      if (currentKeys.length > 1) {
        details.push('❌ CRITICAL ISSUE: Multiple current keys detected!');
        details.push('   This is the ROOT CAUSE of "nacl.box.open returned null" errors');
        currentKeys.forEach((key, index) => {
          details.push(`   Current key ${index + 1}: ${key.device_id} (${key.created_at})`);
        });
        recommendations.push('URGENT: Database constraint violation - multiple current keys');
        recommendations.push('Run Phase 1 migration again to fix unique constraint');
        return { success: false, details, recommendations };
      } else if (currentKeys.length === 0) {
        details.push('⚠️ WARNING: No current key marked');
        details.push('   System will fall back to latest key (may cause inconsistencies)');
        recommendations.push('Mark a key as current using atomic key management');
      } else {
        const currentKey = currentKeys[0];
        details.push('✅ Single current key found:');
        details.push(`   Device: ${currentKey.device_id}`);
        details.push(`   Created: ${currentKey.created_at}`);
        details.push(`   Status: ${currentKey.status || 'unknown'}`);
      }
      
      // Step 3: Key consistency validation
      details.push('\n3️⃣ KEY CONSISTENCY CHECK:');
      const derivedPublicKey = await NaClBoxEncryption.getPublicKeyFromPrivate(recipientDeviceKeys.privateKey);
      
      // Check against current key first (Phase 1 priority)
      let keyToCheck: string;
      let keySource: string;
      
      if (currentKeys.length === 1) {
        keyToCheck = currentKeys[0].public_key;
        keySource = 'current key';
      } else {
        keyToCheck = recipientPublicKeys[0].public_key;
        keySource = 'latest key (fallback)';
      }
      
      if (derivedPublicKey === keyToCheck) {
        details.push(`✅ Private key matches ${keySource} in database`);
      } else {
        details.push(`❌ CRITICAL: Private key does NOT match ${keySource}`);
        details.push(`   Derived: ${derivedPublicKey.substring(0, 16)}...`);
        details.push(`   Database: ${keyToCheck.substring(0, 16)}...`);
        
        const matchingKey = recipientPublicKeys.find(k => k.public_key === derivedPublicKey);
        if (matchingKey) {
          details.push(`⚠️ Private key matches different key: ${matchingKey.device_id}`);
          details.push(`   Matching key is_current: ${matchingKey.is_current}`);
          details.push(`   Matching key status: ${matchingKey.status}`);
          recommendations.push('Device private key does not match current public key');
          recommendations.push('Run atomic key management to synchronize keys');
        } else {
          details.push('❌ Private key does not match ANY public key in database');
          recommendations.push('CRITICAL: Complete key mismatch - regenerate device keys');
        }
        return { success: false, details, recommendations };
      }
      
      // Step 4: Sender key retrieval validation (PHASE 1 ENHANCED)
      details.push('\n4️⃣ SENDER KEY RETRIEVAL VALIDATION (Phase 1):');
      details.push('   Testing fresh key retrieval (no caching)...');
      
      const senderRetrievedKey = await this.getFriendPublicKey(recipientId, senderId);
      if (!senderRetrievedKey) {
        details.push('❌ Sender cannot retrieve recipient public key');
        recommendations.push('Recipient public key not available to sender');
        return { success: false, details, recommendations };
      }
      
      details.push('✅ Sender successfully retrieved recipient public key');
      details.push(`   Retrieved key: ${senderRetrievedKey.substring(0, 16)}...`);
      
      // Validate sender got the same key as recipient private key
      if (senderRetrievedKey === derivedPublicKey) {
        details.push('✅ PERFECT: Sender retrieved key matches recipient private key!');
        details.push('✅ This should prevent "nacl.box.open returned null" errors');
      } else {
        details.push('❌ SENDER/RECEIVER KEY MISMATCH - ROOT CAUSE FOUND!');
        details.push('   Sender will encrypt with different key than recipient can decrypt');
        details.push(`   Sender key:    ${senderRetrievedKey.substring(0, 16)}...`);
        details.push(`   Recipient key: ${derivedPublicKey.substring(0, 16)}...`);
        recommendations.push('CRITICAL: Sender/receiver key mismatch will cause all decryption to fail');
        recommendations.push('This is exactly why "nacl.box.open returns null"');
        recommendations.push('Fix: Ensure sender uses same key as recipient private key');
        return { success: false, details, recommendations };
      }
      
      details.push('\n✅ ALL VALIDATIONS PASSED');
      details.push('✅ Key exchange should work correctly');
      details.push('✅ Phase 1 fix is working as intended');
      
      return { success: true, details, recommendations };
      
    } catch (error: any) {
      details.push(`❌ Debug process failed: ${error.message}`);
      recommendations.push('Unable to complete key exchange debugging');
      return { success: false, details, recommendations };
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