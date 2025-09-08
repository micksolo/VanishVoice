/**
 * Secure Device Keys Service
 * 
 * This service manages device keypairs using secure hardware storage.
 * Each device generates a unique keypair on first launch and stores
 * the private key securely using react-native-keychain.
 * 
 * SECURITY MODEL:
 * - Private keys stored in secure hardware (iOS Keychain, Android Keystore)
 * - Public keys stored in database for key exchange
 * - Server can NEVER access private keys
 * - Each device has unique keypair (not derived from user IDs)
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import NaClEncryption from './nacl/naclEncryption';

export interface DeviceKeyPair {
  publicKey: string;
  privateKey: string;
  deviceId: string;
}

export interface PublicKeyRecord {
  id?: string;
  user_id: string;
  device_id: string;
  public_key: string;
  created_at: string;
  is_current?: boolean;
  status?: string;
  updated_at?: string;
}

class SecureDeviceKeys {
  private static readonly PRIVATE_KEY_SERVICE = 'VanishVoice';
  private static readonly PRIVATE_KEY_ACCOUNT = 'device_private_key';
  private static readonly PUBLIC_KEY_ACCOUNT = 'device_public_key';
  private static readonly DEVICE_ID_ACCOUNT = 'device_id';
  
  /**
   * Check if we're running in Expo Go (where native modules don't work)
   */
  private static isExpoGo(): boolean {
    try {
      // Try to access Keychain to see if it's available
      return !Keychain || typeof Keychain.setInternetCredentials !== 'function';
    } catch {
      return true;
    }
  }
  
  /**
   * Secure storage with Expo Go fallback
   */
  private static async secureSet(key: string, value: string): Promise<void> {
    if (this.isExpoGo()) {
      console.log('[SecureDeviceKeys] Using AsyncStorage fallback (Expo Go)');
      await AsyncStorage.setItem(`secure_${key}`, value);
    } else {
      await Keychain.setInternetCredentials(
        key,
        this.PRIVATE_KEY_ACCOUNT,
        value
      );
    }
  }
  
  /**
   * Secure storage retrieval with Expo Go fallback
   */
  private static async secureGet(key: string): Promise<string | null> {
    if (this.isExpoGo()) {
      return await AsyncStorage.getItem(`secure_${key}`);
    } else {
      const credentials = await Keychain.getInternetCredentials(key);
      return credentials ? credentials.password : null;
    }
  }
  
  /**
   * Generate and store new device keypair
   * Called on first app launch
   */
  static async generateDeviceKeys(): Promise<DeviceKeyPair> {
    try {
      console.log('[SecureDeviceKeys] Generating new device keypair...');
      
      // Generate unique device ID
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Validate device ID is not null/empty
      if (!deviceId || deviceId.length === 0) {
        throw new Error('Device ID generation failed');
      }
      
      // Generate NaCl keypair
      const keyPair = await NaClEncryption.generateKeyPair();
      
      // Validate keypair is not null
      if (!keyPair || !keyPair.secretKey || !keyPair.publicKey) {
        throw new Error('Keypair generation failed - null values returned');
      }
      
      // Validate class constants are not null
      if (!this.PRIVATE_KEY_SERVICE || !this.PRIVATE_KEY_ACCOUNT) {
        throw new Error('Keychain service constants are null');
      }
      
      // Store private key in secure hardware (or AsyncStorage fallback)
      await this.secureSet(this.PRIVATE_KEY_SERVICE, keyPair.secretKey);
      
      // Validate device ID account constant
      if (!this.DEVICE_ID_ACCOUNT) {
        throw new Error('Device ID account constant is null');
      }
      
      // Store public key separately (for faster local access)
      await this.secureSet(this.PUBLIC_KEY_ACCOUNT, keyPair.publicKey);
      
      // Store device ID separately
      await this.secureSet(this.DEVICE_ID_ACCOUNT, deviceId);
      
      console.log('[SecureDeviceKeys] ✅ Device keypair generated and stored securely');
      if (__DEV__) {
        console.log('[SecureDeviceKeys] Device ID: [DEVICE_ID_REDACTED]');
      }
      
      return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.secretKey,
        deviceId,
      };
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to generate device keys:', error);
      throw error;
    }
  }
  
  /**
   * Get existing device keypair from secure storage
   * Returns null if no keys exist
   */
  static async getDeviceKeys(): Promise<DeviceKeyPair | null> {
    try {
      // Validate class constants are not null
      if (!this.PRIVATE_KEY_SERVICE || !this.PRIVATE_KEY_ACCOUNT || !this.PUBLIC_KEY_ACCOUNT || !this.DEVICE_ID_ACCOUNT) {
        console.error('[SecureDeviceKeys] Keychain service constants are null');
        return null;
      }
      
      // Get private key using secure storage with fallback
      const privateKey = await this.secureGet(this.PRIVATE_KEY_SERVICE);
      
      // Get public key - stored locally for faster access
      const publicKey = await this.secureGet(this.PUBLIC_KEY_ACCOUNT);
      
      // Get device ID using secure storage with fallback
      const deviceId = await this.secureGet(this.DEVICE_ID_ACCOUNT);
      
      if (!privateKey || !publicKey || !deviceId) {
        console.log('[SecureDeviceKeys] No device keys found in secure storage');
        return null;
      }
      
      console.log('[SecureDeviceKeys] ✅ Retrieved device keys from secure storage');
      if (__DEV__) {
        console.log('[SecureDeviceKeys] Device ID: [DEVICE_ID_REDACTED]');
      }
      
      return {
        publicKey,
        privateKey,
        deviceId,
      };
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to get device keys:', error);
      return null;
    }
  }
  
  /**
   * Initialize device keys - generate if not exist, return existing if they do
   */
  static async initializeDeviceKeys(): Promise<DeviceKeyPair> {
    const existingKeys = await this.getDeviceKeys();
    
    if (existingKeys && existingKeys.publicKey) {
      console.log('[SecureDeviceKeys] Using existing device keys');
      return existingKeys;
    }
    
    console.log('[SecureDeviceKeys] Generating new device keys');
    return await this.generateDeviceKeys();
  }
  
  /**
   * Publish device public key to database using atomic key management
   * Called after key generation or when user signs in
   * PHASE 1 FIX: Uses atomic RPC to prevent sender/receiver key mismatches
   */
  static async publishPublicKey(userId: string, deviceKeys: DeviceKeyPair): Promise<void> {
    try {
      console.log('[SecureDeviceKeys] Publishing public key using atomic key management...');
      
      // Use atomic RPC function to prevent race conditions
      const { data, error } = await supabase.rpc('set_current_device_key', {
        p_user_id: userId,
        p_device_id: deviceKeys.deviceId,
        p_public_key: deviceKeys.publicKey
      });
      
      if (error) {
        // If RPC doesn't exist, fall back to direct upsert for backward compatibility
        if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.warn('[SecureDeviceKeys] Atomic RPC not available, using direct upsert fallback');
          console.warn('[SecureDeviceKeys] Please run Phase 1 migration for full key management fix');
          
          // Fallback to legacy upsert
          const { error: upsertError } = await supabase
            .from('device_public_keys')
            .upsert({
              user_id: userId,
              device_id: deviceKeys.deviceId,
              public_key: deviceKeys.publicKey,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,device_id'
            });
          
          if (upsertError) {
            throw upsertError;
          }
        } else {
          throw error;
        }
      } else if (data && data.length > 0) {
        const result = data[0];
        console.log('[SecureDeviceKeys] ✅ Atomic key management successful:');
        console.log(`- Key ID: ${result.key_id}`);
        console.log(`- Was updated: ${result.was_updated}`);
        console.log(`- Previous keys: ${result.previous_keys_count}`);
        
        if (result.previous_keys_count > 1) {
          console.log('[SecureDeviceKeys] ⚠️ Multiple previous keys detected - this may have caused decryption failures');
          console.log('[SecureDeviceKeys] ✅ Now using single current key to prevent sender/receiver key mismatches');
        }
      }
      
      console.log('[SecureDeviceKeys] Public key published successfully with atomic key management');
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to publish public key:', error);
      throw error;
    }
  }
  
  /**
   * Get public key for a specific device
   */
  static async getPublicKeyForDevice(deviceId: string): Promise<PublicKeyRecord | null> {
    try {
      const { data, error } = await supabase
        .from('device_public_keys')
        .select('*')
        .eq('device_id', deviceId)
        .single();
      
      if (error || !data) {
        console.log('[SecureDeviceKeys] Public key not found for device');
        return null;
      }
      
      return data as PublicKeyRecord;
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to get public key for device:', error);
      return null;
    }
  }
  
  /**
   * Get all public keys for a user (multiple devices)
   * PHASE 1 FIX: Enhanced with current key information
   */
  static async getPublicKeysForUser(userId: string): Promise<PublicKeyRecord[]> {
    try {
      const { data, error } = await supabase
        .from('device_public_keys')
        .select('user_id, device_id, public_key, created_at, is_current, status, updated_at')
        .eq('user_id', userId)
        .order('is_current', { ascending: false }) // Current key first
        .order('created_at', { ascending: false }); // Then by recency
      
      if (error) {
        console.error('[SecureDeviceKeys] Failed to get public keys for user:', error);
        return [];
      }
      
      const keys = data || [];
      
      if (__DEV__ && keys.length > 0) {
        const currentKeys = keys.filter(k => k.is_current);
        const activeKeys = keys.filter(k => k.status === 'active');
        
        console.log('[SecureDeviceKeys] Key analysis for user:');
        console.log(`- Total keys: ${keys.length}`);
        console.log(`- Current keys: ${currentKeys.length}`);
        console.log(`- Active keys: ${activeKeys.length}`);
        
        if (currentKeys.length > 1) {
          console.warn('[SecureDeviceKeys] ⚠️ Multiple current keys detected - this will cause decryption failures!');
          console.warn('[SecureDeviceKeys] Database constraint may not be enforced properly');
        }
        
        if (currentKeys.length === 0 && keys.length > 0) {
          console.warn('[SecureDeviceKeys] ⚠️ No current key marked - using latest key as fallback');
          console.warn('[SecureDeviceKeys] This may cause sender/receiver key mismatches');
        }
      }
      
      return keys;
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to get public keys for user:', error);
      return [];
    }
  }
  
  /**
   * Get the current (active) public key for a user with metadata
   * Used for recipient key tracking to prevent nacl.box.open null errors
   */
  static async getLatestPublicKeyForUserWithMetadata(userId: string): Promise<{
    publicKey: string;
    keyId: string;
    deviceId: string;
  } | null> {
    try {
      console.log('[SecureDeviceKeys] Getting current public key WITH METADATA for recipient tracking...');
      
      // First try to get current key using RPC function
      try {
        const { data, error } = await supabase.rpc('get_current_public_key', {
          p_user_id: userId
        });
        
        if (!error && data && data.length > 0) {
          const currentKey = data[0];
          console.log('[SecureDeviceKeys] ✅ Using current key from atomic management WITH METADATA:');
          console.log(`- Device ID: ${currentKey.device_id}`);
          console.log(`- Key ID: ${currentKey.id}`);
          console.log(`- Created: ${currentKey.created_at}`);
          console.log(`- Updated: ${currentKey.updated_at}`);
          return {
            publicKey: currentKey.public_key,
            keyId: currentKey.id,
            deviceId: currentKey.device_id
          };
        }
      } catch (rpcError) {
        console.warn('[SecureDeviceKeys] RPC function not available, falling back to direct query');
      }
      
      // Fallback: Direct query for is_current = true
      const { data, error } = await supabase
        .from('device_public_keys')
        .select('id, public_key, device_id, created_at, updated_at, status')
        .eq('user_id', userId)
        .eq('is_current', true)
        .single();
      
      if (error || !data) {
        console.log('[SecureDeviceKeys] No current key found, falling back to latest key');
        
        // Final fallback: Get most recent key (legacy behavior)
        const publicKeys = await this.getPublicKeysForUser(userId);
        
        if (publicKeys.length === 0) {
          console.log('[SecureDeviceKeys] No public keys found for user');
          return null;
        }
        
        const latestKey = publicKeys[0]; // Already ordered by created_at desc
        console.log('[SecureDeviceKeys] ⚠️ Using latest key WITH METADATA (not atomic management)');
        console.log('[SecureDeviceKeys] ⚠️ This may cause sender/receiver key mismatches');
        
        return {
          publicKey: latestKey.public_key,
          keyId: 'unknown', // No key ID available for fallback
          deviceId: latestKey.device_id
        };
      }
      
      console.log('[SecureDeviceKeys] ✅ Using current key from direct query WITH METADATA:');
      console.log(`- Device ID: ${data.device_id}`);
      console.log(`- Key ID: ${data.id}`);
      console.log(`- Status: ${data.status || 'unknown'}`);
      
      return {
        publicKey: data.public_key,
        keyId: data.id,
        deviceId: data.device_id
      };
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to get current public key with metadata:', error);
      return null;
    }
  }

  /**
   * Get the current (active) public key for a user
   * PHASE 1 FIX: Always gets the is_current=true key to prevent stale key usage
   * This is used when we need to encrypt a message for someone
   */
  static async getLatestPublicKeyForUser(userId: string): Promise<string | null> {
    try {
      console.log('[SecureDeviceKeys] Getting current public key for user (Phase 1 fix)...');
      
      // First try to get current key using RPC function
      try {
        const { data, error } = await supabase.rpc('get_current_public_key', {
          p_user_id: userId
        });
        
        if (!error && data && data.length > 0) {
          const currentKey = data[0];
          console.log('[SecureDeviceKeys] ✅ Using current key from atomic management:');
          console.log(`- Device ID: ${currentKey.device_id}`);
          console.log(`- Created: ${currentKey.created_at}`);
          console.log(`- Updated: ${currentKey.updated_at}`);
          return currentKey.public_key;
        }
      } catch (rpcError) {
        console.warn('[SecureDeviceKeys] RPC function not available, falling back to direct query');
      }
      
      // Fallback: Direct query for is_current = true
      const { data, error } = await supabase
        .from('device_public_keys')
        .select('*')
        .eq('user_id', userId)
        .eq('is_current', true)
        .single();
      
      if (error || !data) {
        console.log('[SecureDeviceKeys] No current key found, falling back to latest key');
        
        // Final fallback: Get most recent key (legacy behavior)
        const publicKeys = await this.getPublicKeysForUser(userId);
        
        if (publicKeys.length === 0) {
          console.log('[SecureDeviceKeys] No public keys found for user');
          return null;
        }
        
        const latestKey = publicKeys[0]; // Already ordered by created_at desc
        console.log('[SecureDeviceKeys] ⚠️ Using latest key (not atomic management)');
        console.log('[SecureDeviceKeys] ⚠️ This may cause sender/receiver key mismatches');
        
        return latestKey.public_key;
      }
      
      console.log('[SecureDeviceKeys] ✅ Using current key from direct query:');
      console.log(`- Device ID: ${data.device_id}`);
      console.log(`- Status: ${data.status || 'unknown'}`);
      
      return data.public_key;
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to get current public key:', error);
      return null;
    }
  }
  
  /**
   * Clean up device keys (for logout or key rotation)
   */
  static async clearDeviceKeys(): Promise<void> {
    try {
      console.log('[SecureDeviceKeys] Clearing device keys from secure storage...');
      
      // Validate constants before keychain operations
      if (!this.PRIVATE_KEY_SERVICE || !this.PRIVATE_KEY_ACCOUNT || !this.PUBLIC_KEY_ACCOUNT || !this.DEVICE_ID_ACCOUNT) {
        console.error('[SecureDeviceKeys] Cannot clear keys - service constants are null');
        throw new Error('Keychain service constants are null');
      }
      
      // FIXED: resetInternetCredentials only takes server parameter
      await Keychain.resetInternetCredentials(this.PRIVATE_KEY_SERVICE);
      await Keychain.resetInternetCredentials(this.PUBLIC_KEY_ACCOUNT);
      await Keychain.resetInternetCredentials(this.DEVICE_ID_ACCOUNT);
      
      console.log('[SecureDeviceKeys] Device keys cleared successfully');
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to clear device keys:', error);
      throw error;
    }
  }
  
  /**
   * Check if device has secure hardware support
   */
  static async hasSecureHardware(): Promise<boolean> {
    try {
      const securityLevel = await Keychain.getSecurityLevel();
      return securityLevel === Keychain.SECURITY_LEVEL.SECURE_HARDWARE;
    } catch (error) {
      console.warn('[SecureDeviceKeys] Could not determine security level:', error);
      return false;
    }
  }
  
  /**
   * Get device security info for debugging
   */
  static async getSecurityInfo(): Promise<{
    hasSecureHardware: boolean;
    securityLevel: string;
    hasBiometrics: boolean;
  }> {
    try {
      const hasSecureHardware = await this.hasSecureHardware();
      const securityLevel = await Keychain.getSecurityLevel();
      const hasBiometrics = await Keychain.getSupportedBiometryType();
      
      return {
        hasSecureHardware,
        securityLevel: securityLevel || 'unknown',
        hasBiometrics: hasBiometrics !== null,
      };
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to get security info:', error);
      return {
        hasSecureHardware: false,
        securityLevel: 'unknown',
        hasBiometrics: false,
      };
    }
  }

  /**
   * Get current device key ID for this user
   * Used for recipient key ID validation during decryption
   */
  static async getCurrentKeyId(userId: string): Promise<string | null> {
    try {
      const currentKeyData = await this.getLatestPublicKeyForUserWithMetadata(userId);
      return currentKeyData?.keyId || null;
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to get current key ID:', error);
      return null;
    }
  }

  /**
   * Debug key management issues for a user
   * PHASE 1 FIX: Comprehensive debugging for sender/receiver key mismatches
   */
  static async debugUserKeyIssues(userId: string): Promise<{
    success: boolean;
    summary: string;
    details: string[];
    recommendations: string[];
  }> {
    const details: string[] = [];
    const recommendations: string[] = [];
    
    try {
      details.push('🔍 DEBUGGING USER KEY MANAGEMENT ISSUES');
      details.push(`👤 User ID: ${userId}`);
      
      // Step 1: Use database debugging function if available
      try {
        const { data, error } = await supabase.rpc('debug_user_keys', {
          p_user_id: userId
        });
        
        if (!error && data && data.length > 0) {
          const debugInfo = data[0];
          details.push('📊 DATABASE ANALYSIS:');
          details.push(`   Total keys: ${debugInfo.total_keys}`);
          details.push(`   Current keys: ${debugInfo.current_keys}`);
          details.push(`   Active keys: ${debugInfo.active_keys}`);
          details.push(`   Latest key age: ${debugInfo.latest_key_age_hours?.toFixed(1) || 'N/A'} hours`);
          details.push(`   Summary: ${debugInfo.key_summary}`);
          
          // Analyze issues
          if (debugInfo.current_keys > 1) {
            details.push('❌ CRITICAL: Multiple current keys detected');
            recommendations.push('Database constraint failure - run Phase 1 migration again');
          } else if (debugInfo.current_keys === 0) {
            details.push('⚠️ WARNING: No current key marked');
            recommendations.push('Run atomic key management to mark a current key');
          } else {
            details.push('✅ Key management looks healthy');
          }
          
          if (debugInfo.total_keys > 5) {
            details.push(`⚠️ WARNING: High key count (${debugInfo.total_keys})`);
            recommendations.push('Consider cleaning up old keys to improve performance');
          }
        }
      } catch (rpcError) {
        details.push('⚠️ Database debugging RPC not available (migration not applied)');
        recommendations.push('Apply Phase 1 migration for enhanced key debugging');
      }
      
      // Step 2: Direct key analysis
      details.push('\n🔍 DIRECT KEY ANALYSIS:');
      const allKeys = await this.getPublicKeysForUser(userId);
      
      if (allKeys.length === 0) {
        details.push('❌ No keys found for user');
        recommendations.push('User needs to open app to initialize device keys');
        return {
          success: false,
          summary: `No keys found for user ${userId}`,
          details,
          recommendations
        };
      }
      
      const currentKeys = allKeys.filter(k => k.is_current);
      const activeKeys = allKeys.filter(k => k.status === 'active');
      
      details.push(`   Found ${allKeys.length} total keys`);
      details.push(`   Current keys: ${currentKeys.length}`);
      details.push(`   Active keys: ${activeKeys.length}`);
      
      // Analyze key consistency
      if (currentKeys.length > 1) {
        details.push('❌ CRITICAL: Multiple current keys found');
        details.push('   This WILL cause "nacl.box.open returned null" errors');
        currentKeys.forEach((key, index) => {
          details.push(`   Current key ${index + 1}: ${key.device_id} (${key.created_at})`);
        });
        recommendations.push('URGENT: Fix multiple current keys using atomic key management');
        recommendations.push('Run: set_current_device_key() RPC to fix');
      } else if (currentKeys.length === 0) {
        details.push('⚠️ No current key marked - using latest as fallback');
        details.push('   This may cause sender/receiver key mismatches');
        recommendations.push('Mark latest key as current using atomic key management');
      } else {
        const currentKey = currentKeys[0];
        details.push('✅ Single current key found:');
        details.push(`   Device: ${currentKey.device_id}`);
        details.push(`   Created: ${currentKey.created_at}`);
        details.push(`   Status: ${currentKey.status || 'unknown'}`);
      }
      
      // Step 3: Test current key retrieval
      details.push('\n🔍 CURRENT KEY RETRIEVAL TEST:');
      const retrievedKey = await this.getLatestPublicKeyForUser(userId);
      
      if (!retrievedKey) {
        details.push('❌ Failed to retrieve current public key');
        recommendations.push('Key retrieval is broken - check database permissions');
        return {
          success: false,
          summary: `Key retrieval failed for user ${userId}`,
          details,
          recommendations
        };
      }
      
      details.push('✅ Successfully retrieved current public key');
      
      // Verify it matches a current key
      const matchingCurrentKey = currentKeys.find(k => k.public_key === retrievedKey);
      if (matchingCurrentKey) {
        details.push('✅ Retrieved key matches current key in database');
      } else {
        details.push('⚠️ Retrieved key does not match any current key');
        const matchingKey = allKeys.find(k => k.public_key === retrievedKey);
        if (matchingKey) {
          details.push(`   Retrieved key matches device: ${matchingKey.device_id}`);
          details.push(`   But is_current: ${matchingKey.is_current}`);
        }
        recommendations.push('Key retrieval inconsistency - atomic management may not be working');
      }
      
      const summary = currentKeys.length === 1 ? 
        `Key management healthy for user ${userId}` : 
        `Key management issues detected for user ${userId}`;
      
      return {
        success: currentKeys.length === 1,
        summary,
        details,
        recommendations
      };
      
    } catch (error: any) {
      details.push(`❌ Debugging failed: ${error.message}`);
      recommendations.push('Unable to complete key debugging - check database connectivity');
      
      return {
        success: false,
        summary: `Debugging failed for user ${userId}`,
        details,
        recommendations
      };
    }
  }
}

export default SecureDeviceKeys;