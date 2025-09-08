import AsyncStorage from '@react-native-async-storage/async-storage';
import NaClEncryption from './naclEncryption';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';

/**
 * Secure Key Storage using platform-specific secure storage
 * 
 * IMPORTANT: Install react-native-keychain first:
 * npm install react-native-keychain
 * cd ios && pod install
 * 
 * Then uncomment the Keychain import and implementations below
 */

// Uncomment when react-native-keychain is installed:
// import * as Keychain from 'react-native-keychain';

interface StoredKeys {
  publicKey: string;
  secretKey: string;
  createdAt: number;
  version: number;
}

const KEYCHAIN_SERVICE = 'com.vanishvoice.keys';
const KEYCHAIN_ACCESS_GROUP = 'com.vanishvoice.app'; // For iOS shared keychain

class NaClKeyStorage {
  private static readonly KEY_VERSION = 3; // NaCl keys version

  // Store keys securely using platform keychain
  static async storeKeys(userId: string, keys: { publicKey: string; secretKey: string }): Promise<void> {
    try {
      const storageData: StoredKeys = {
        ...keys,
        createdAt: Date.now(),
        version: this.KEY_VERSION,
      };

      // When react-native-keychain is installed:
      // if (Platform.OS === 'ios' || Platform.OS === 'android') {
      //   await Keychain.setInternetCredentials(
      //     KEYCHAIN_SERVICE,
      //     userId,
      //     JSON.stringify(storageData),
      //     {
      //       accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      //       accessGroup: KEYCHAIN_ACCESS_GROUP,
      //       authenticatePrompt: 'Authenticate to access your encryption keys',
      //       authenticationPrompt: {
      //         title: 'VanishVoice',
      //         subtitle: 'Access your encryption keys',
      //         description: 'Your keys are needed to decrypt messages',
      //         cancel: 'Cancel',
      //       },
      //     }
      //   );
      //   console.log('[NaClKeyStorage] Keys stored in secure keychain');
      // } else {
      //   // Fallback for web/other platforms
      //   await this.storeKeysInAsyncStorage(userId, storageData);
      // }

      // Temporary: Use AsyncStorage until keychain is available
      await this.storeKeysInAsyncStorage(userId, storageData);
      
    } catch (error) {
      console.error('[NaClKeyStorage] Error storing keys:', error);
      throw new Error('Failed to store encryption keys securely');
    }
  }

  // Retrieve keys from secure storage
  static async retrieveKeys(userId: string): Promise<{ publicKey: string; secretKey: string } | null> {
    try {
      // When react-native-keychain is installed:
      // if (Platform.OS === 'ios' || Platform.OS === 'android') {
      //   const credentials = await Keychain.getInternetCredentials(KEYCHAIN_SERVICE);
      //   if (credentials && credentials.username === userId) {
      //     const storageData: StoredKeys = JSON.parse(credentials.password);
      //     
      //     // Check version compatibility
      //     if (storageData.version !== this.KEY_VERSION) {
      //       console.log('[NaClKeyStorage] Key version mismatch, regeneration needed');
      //       return null;
      //     }
      //     
      //     return {
      //       publicKey: storageData.publicKey,
      //       secretKey: storageData.secretKey,
      //     };
      //   }
      // } else {
      //   // Fallback for web/other platforms
      //   return await this.retrieveKeysFromAsyncStorage(userId);
      // }

      // Temporary: Use AsyncStorage until keychain is available
      return await this.retrieveKeysFromAsyncStorage(userId);
      
    } catch (error) {
      console.error('[NaClKeyStorage] Error retrieving keys:', error);
      return null;
    }
  }

  // Delete keys securely
  static async deleteKeys(userId: string): Promise<void> {
    try {
      // When react-native-keychain is installed:
      // if (Platform.OS === 'ios' || Platform.OS === 'android') {
      //   await Keychain.resetInternetCredentials(KEYCHAIN_SERVICE);
      //   console.log('[NaClKeyStorage] Keys deleted from keychain');
      // } else {
      //   await this.deleteKeysFromAsyncStorage(userId);
      // }

      // Temporary: Use AsyncStorage until keychain is available
      await this.deleteKeysFromAsyncStorage(userId);
      
    } catch (error) {
      console.error('[NaClKeyStorage] Error deleting keys:', error);
    }
  }

  // Check if user has keys
  static async hasKeys(userId: string): Promise<boolean> {
    const keys = await this.retrieveKeys(userId);
    return keys !== null;
  }

  // Generate and store new NaCl keys
  static async generateAndStoreKeys(userId: string): Promise<{ publicKey: string; secretKey: string }> {
    try {
      // Generate new NaCl key pair
      const keys = await NaClEncryption.generateKeyPair();
      
      // Store securely
      await this.storeKeys(userId, keys);
      
      console.log('[NaClKeyStorage] New NaCl keys generated and stored');
      return keys;
    } catch (error) {
      console.error('[NaClKeyStorage] Error generating keys:', error);
      throw new Error('Failed to generate encryption keys');
    }
  }

  // Migrate from old key storage
  static async migrateFromOldStorage(userId: string): Promise<boolean> {
    try {
      // Check if already has NaCl keys
      if (await this.hasKeys(userId)) {
        console.log('[NaClKeyStorage] Already has NaCl keys');
        return true;
      }

      // Check for old keys in various locations
      const oldKeyLocations = [
        `vanishvoice_secure_keys_${userId}`,
        `vanishvoice_keys_${userId}`,
      ];

      for (const location of oldKeyLocations) {
        const oldKeysStr = await AsyncStorage.getItem(location);
        if (oldKeysStr) {
          console.log('[NaClKeyStorage] Found old keys, generating new NaCl keys');
          
          // Generate new NaCl keys (old keys aren't compatible)
          await this.generateAndStoreKeys(userId);
          
          // Clean up old storage
          await AsyncStorage.removeItem(location);
          await AsyncStorage.removeItem(`${location}_backup`);
          
          return true;
        }
      }

      console.log('[NaClKeyStorage] No old keys found');
      return false;
    } catch (error) {
      console.error('[NaClKeyStorage] Migration error:', error);
      return false;
    }
  }

  // --- Fallback AsyncStorage methods (temporary) ---

  private static async storeKeysInAsyncStorage(userId: string, storageData: StoredKeys): Promise<void> {
    // Encrypt keys before storing in AsyncStorage
    const deviceKey = await this.getDeviceKey();
    const encrypted = await this.encryptData(JSON.stringify(storageData), deviceKey);
    
    await AsyncStorage.setItem(
      `vanishvoice_nacl_keys_${userId}`,
      JSON.stringify(encrypted)
    );
    
    console.log('[NaClKeyStorage] Keys stored in AsyncStorage (temporary)');
  }

  private static async retrieveKeysFromAsyncStorage(userId: string): Promise<{ publicKey: string; secretKey: string } | null> {
    const encryptedStr = await AsyncStorage.getItem(`vanishvoice_nacl_keys_${userId}`);
    if (!encryptedStr) return null;

    try {
      const encrypted = JSON.parse(encryptedStr);
      const deviceKey = await this.getDeviceKey();
      const decrypted = await this.decryptData(encrypted, deviceKey);
      const storageData: StoredKeys = JSON.parse(decrypted);

      if (storageData.version !== this.KEY_VERSION) {
        console.log('[NaClKeyStorage] Key version mismatch');
        return null;
      }

      return {
        publicKey: storageData.publicKey,
        secretKey: storageData.secretKey,
      };
    } catch (error) {
      console.error('[NaClKeyStorage] Error parsing stored keys:', error);
      return null;
    }
  }

  private static async deleteKeysFromAsyncStorage(userId: string): Promise<void> {
    await AsyncStorage.removeItem(`vanishvoice_nacl_keys_${userId}`);
  }

  // Simple encryption for AsyncStorage (until keychain is available)
  private static async getDeviceKey(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      await AsyncStorage.setItem('device_id', deviceId);
    }
    return deviceId + '_vanishvoice_nacl_2024';
  }

  private static async encryptData(data: string, key: string): Promise<{ data: string; nonce: string }> {
    // Simple XOR for AsyncStorage (temporary)
    const keyBuffer = Buffer.from(key);
    const dataBuffer = Buffer.from(data);
    const nonce = Math.random().toString(36).substring(2);
    
    const encrypted = Buffer.alloc(dataBuffer.length);
    for (let i = 0; i < dataBuffer.length; i++) {
      encrypted[i] = dataBuffer[i] ^ keyBuffer[i % keyBuffer.length] ^ nonce.charCodeAt(i % nonce.length);
    }
    
    return {
      data: encrypted.toString('base64'),
      nonce,
    };
  }

  private static async decryptData(encrypted: { data: string; nonce: string }, key: string): Promise<string> {
    const keyBuffer = Buffer.from(key);
    const dataBuffer = Buffer.from(encrypted.data, 'base64');
    
    const decrypted = Buffer.alloc(dataBuffer.length);
    for (let i = 0; i < dataBuffer.length; i++) {
      decrypted[i] = dataBuffer[i] ^ keyBuffer[i % keyBuffer.length] ^ encrypted.nonce.charCodeAt(i % encrypted.nonce.length);
    }
    
    return decrypted.toString();
  }
}

export default NaClKeyStorage;

/**
 * Security Features when react-native-keychain is installed:
 * 
 * iOS:
 * - Keys stored in iOS Keychain
 * - Hardware encryption
 * - Biometric/passcode protection
 * - Accessible only when device unlocked
 * 
 * Android:
 * - Keys stored in Android Keystore
 * - Hardware-backed security (if available)
 * - Biometric/PIN protection
 * - Encryption at rest
 * 
 * Benefits:
 * - Keys survive app reinstalls
 * - OS-level security
 * - Tamper protection
 * - Secure enclave usage (where available)
 */