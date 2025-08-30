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
import { supabase } from '../services/supabase';
import NaClEncryption from './nacl/naclEncryption';

export interface DeviceKeyPair {
  publicKey: string;
  privateKey: string;
  deviceId: string;
}

export interface PublicKeyRecord {
  user_id: string;
  device_id: string;
  public_key: string;
  created_at: string;
}

class SecureDeviceKeys {
  private static readonly PRIVATE_KEY_SERVICE = 'VanishVoice';
  private static readonly PRIVATE_KEY_ACCOUNT = 'device_private_key';
  private static readonly PUBLIC_KEY_ACCOUNT = 'device_public_key';
  private static readonly DEVICE_ID_ACCOUNT = 'device_id';
  
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
      
      // Store private key in secure hardware
      await Keychain.setInternetCredentials(
        this.PRIVATE_KEY_SERVICE,
        this.PRIVATE_KEY_ACCOUNT,
        keyPair.secretKey,
        {
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          authenticationType: Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
          securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
          storage: Keychain.STORAGE_TYPE.RSA,
        }
      );
      
      // Validate device ID account constant
      if (!this.DEVICE_ID_ACCOUNT) {
        throw new Error('Device ID account constant is null');
      }
      
      // Store public key separately (for faster local access)
      await Keychain.setInternetCredentials(
        this.PRIVATE_KEY_SERVICE,
        this.PUBLIC_KEY_ACCOUNT,
        keyPair.publicKey,
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
          securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
        }
      );
      
      // Store device ID separately
      await Keychain.setInternetCredentials(
        this.PRIVATE_KEY_SERVICE,
        this.DEVICE_ID_ACCOUNT,
        deviceId,
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
          securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
        }
      );
      
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
      
      // Get private key - FIXED: getInternetCredentials only takes server parameter
      const privateKeyCredentials = await Keychain.getInternetCredentials(
        this.PRIVATE_KEY_SERVICE
      );
      
      // Get public key - stored locally for faster access
      const publicKeyCredentials = await Keychain.getInternetCredentials(
        this.PUBLIC_KEY_ACCOUNT
      );
      
      // Get device ID - FIXED: getInternetCredentials only takes server parameter  
      const deviceIdCredentials = await Keychain.getInternetCredentials(
        this.DEVICE_ID_ACCOUNT
      );
      
      if (!privateKeyCredentials || !publicKeyCredentials || !deviceIdCredentials) {
        console.log('[SecureDeviceKeys] No device keys found in secure storage');
        return null;
      }
      
      // Validate credentials have password field
      if (!privateKeyCredentials.password || !publicKeyCredentials.password || !deviceIdCredentials.password) {
        console.log('[SecureDeviceKeys] Keychain credentials missing password field');
        return null;
      }
      
      const privateKey = privateKeyCredentials.password;
      const publicKey = publicKeyCredentials.password;
      const deviceId = deviceIdCredentials.password;
      
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
   * Publish device public key to database
   * Called after key generation or when user signs in
   */
  static async publishPublicKey(userId: string, deviceKeys: DeviceKeyPair): Promise<void> {
    try {
      console.log('[SecureDeviceKeys] Publishing public key to database...');
      
      const { error } = await supabase
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
      
      if (error) {
        // If table doesn't exist, warn but don't fail
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('[SecureDeviceKeys] device_public_keys table does not exist yet.');
          console.warn('[SecureDeviceKeys] Please create migration for device_public_keys table');
          return; // Don't throw, continue with local keys
        }
        throw error;
      }
      
      console.log('[SecureDeviceKeys] Public key published successfully');
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
   */
  static async getPublicKeysForUser(userId: string): Promise<PublicKeyRecord[]> {
    try {
      const { data, error } = await supabase
        .from('device_public_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[SecureDeviceKeys] Failed to get public keys for user:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('[SecureDeviceKeys] Failed to get public keys for user:', error);
      return [];
    }
  }
  
  /**
   * Get the latest (most recent) public key for a user
   * This is used when we need to encrypt a message for someone
   */
  static async getLatestPublicKeyForUser(userId: string): Promise<string | null> {
    const publicKeys = await this.getPublicKeysForUser(userId);
    
    if (publicKeys.length === 0) {
      console.log('[SecureDeviceKeys] No public keys found for user');
      return null;
    }
    
    // Return the most recent public key
    const latestKey = publicKeys[0]; // Already ordered by created_at desc
    console.log('[SecureDeviceKeys] Using latest public key for user');
    
    return latestKey.public_key;
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
}

export default SecureDeviceKeys;