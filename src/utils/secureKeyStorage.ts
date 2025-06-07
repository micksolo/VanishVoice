import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

/**
 * Secure Key Storage Utility
 * 
 * Provides encrypted storage for cryptographic keys
 * In production, should use:
 * - iOS: Keychain Services
 * - Android: Android Keystore
 * 
 * Install for production: npm install react-native-keychain
 */

// Derive a key encryption key from device-specific data
const getDeviceEncryptionKey = async (): Promise<string> => {
  // In production, this should use device hardware security features
  const deviceId = Platform.OS + '_' + (await AsyncStorage.getItem('device_id') || 'default');
  
  // Create a device-specific encryption key
  const deviceKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    deviceId + 'vanishvoice_key_encryption_2024',
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  
  return deviceKey;
};

// Encrypt data before storage
const encryptForStorage = async (data: string): Promise<{ encrypted: string; iv: string }> => {
  const deviceKey = await getDeviceEncryptionKey();
  const iv = await Crypto.getRandomBytesAsync(16);
  
  // Simple encryption for AsyncStorage
  // In production, use proper AES from react-native-crypto
  const keyBuffer = Buffer.from(deviceKey, 'base64');
  const dataBuffer = Buffer.from(data, 'utf8');
  const ivBuffer = Buffer.from(iv);
  
  // XOR with key stretched by IV
  const encrypted = Buffer.alloc(dataBuffer.length);
  for (let i = 0; i < dataBuffer.length; i++) {
    const keyByte = keyBuffer[(i + ivBuffer[i % 16]) % keyBuffer.length];
    encrypted[i] = dataBuffer[i] ^ keyByte;
  }
  
  return {
    encrypted: encrypted.toString('base64'),
    iv: ivBuffer.toString('base64')
  };
};

// Decrypt data from storage
const decryptFromStorage = async (encrypted: string, iv: string): Promise<string> => {
  const deviceKey = await getDeviceEncryptionKey();
  
  const keyBuffer = Buffer.from(deviceKey, 'base64');
  const encryptedBuffer = Buffer.from(encrypted, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');
  
  // XOR with key stretched by IV (same as encryption)
  const decrypted = Buffer.alloc(encryptedBuffer.length);
  for (let i = 0; i < encryptedBuffer.length; i++) {
    const keyByte = keyBuffer[(i + ivBuffer[i % 16]) % keyBuffer.length];
    decrypted[i] = encryptedBuffer[i] ^ keyByte;
  }
  
  return decrypted.toString('utf8');
};

// Store keys securely
export const storeKeysSecurely = async (
  userId: string,
  keys: { publicKey: string; privateKey: string }
): Promise<void> => {
  try {
    // Encrypt the keys
    const keysJson = JSON.stringify(keys);
    const { encrypted, iv } = await encryptForStorage(keysJson);
    
    // Store encrypted keys with IV
    const storageData = {
      encrypted,
      iv,
      version: 2, // Secure storage version
      timestamp: Date.now()
    };
    
    await AsyncStorage.setItem(
      `vanishvoice_secure_keys_${userId}`,
      JSON.stringify(storageData)
    );
    
    // Also store a backup in case of corruption
    await AsyncStorage.setItem(
      `vanishvoice_secure_keys_backup_${userId}`,
      JSON.stringify(storageData)
    );
    
    console.log('[SecureKeyStorage] Keys stored securely');
  } catch (error) {
    console.error('[SecureKeyStorage] Error storing keys:', error);
    throw error;
  }
};

// Retrieve keys securely
export const retrieveKeysSecurely = async (
  userId: string
): Promise<{ publicKey: string; privateKey: string } | null> => {
  try {
    // Try primary storage first
    let storageDataStr = await AsyncStorage.getItem(`vanishvoice_secure_keys_${userId}`);
    
    // Fall back to backup if primary fails
    if (!storageDataStr) {
      console.log('[SecureKeyStorage] Primary storage empty, trying backup');
      storageDataStr = await AsyncStorage.getItem(`vanishvoice_secure_keys_backup_${userId}`);
    }
    
    if (!storageDataStr) {
      return null;
    }
    
    const storageData = JSON.parse(storageDataStr);
    
    // Check version
    if (storageData.version !== 2) {
      console.log('[SecureKeyStorage] Old key format found, needs migration');
      return null;
    }
    
    // Decrypt the keys
    const decrypted = await decryptFromStorage(storageData.encrypted, storageData.iv);
    const keys = JSON.parse(decrypted);
    
    console.log('[SecureKeyStorage] Keys retrieved successfully');
    return keys;
  } catch (error) {
    console.error('[SecureKeyStorage] Error retrieving keys:', error);
    
    // Try backup
    try {
      const backupStr = await AsyncStorage.getItem(`vanishvoice_secure_keys_backup_${userId}`);
      if (backupStr) {
        const backupData = JSON.parse(backupStr);
        const decrypted = await decryptFromStorage(backupData.encrypted, backupData.iv);
        return JSON.parse(decrypted);
      }
    } catch (backupError) {
      console.error('[SecureKeyStorage] Backup also failed:', backupError);
    }
    
    return null;
  }
};

// Delete keys securely
export const deleteKeysSecurely = async (userId: string): Promise<void> => {
  try {
    // Overwrite with random data before deletion
    const randomData = await Crypto.getRandomBytesAsync(256);
    const randomStr = Buffer.from(randomData).toString('base64');
    
    // Overwrite multiple times
    for (let i = 0; i < 3; i++) {
      await AsyncStorage.setItem(`vanishvoice_secure_keys_${userId}`, randomStr);
      await AsyncStorage.setItem(`vanishvoice_secure_keys_backup_${userId}`, randomStr);
    }
    
    // Finally remove
    await AsyncStorage.removeItem(`vanishvoice_secure_keys_${userId}`);
    await AsyncStorage.removeItem(`vanishvoice_secure_keys_backup_${userId}`);
    
    // Also remove old insecure keys if they exist
    await AsyncStorage.removeItem(`vanishvoice_keys_${userId}`);
    
    console.log('[SecureKeyStorage] Keys deleted securely');
  } catch (error) {
    console.error('[SecureKeyStorage] Error deleting keys:', error);
  }
};

// Migrate from old key storage to secure storage
export const migrateToSecureStorage = async (userId: string): Promise<boolean> => {
  try {
    // Check if already migrated
    const secureKeys = await retrieveKeysSecurely(userId);
    if (secureKeys) {
      console.log('[SecureKeyStorage] Already migrated');
      return true;
    }
    
    // Try to get old keys
    const oldKeysStr = await AsyncStorage.getItem(`vanishvoice_keys_${userId}`);
    if (!oldKeysStr) {
      console.log('[SecureKeyStorage] No old keys to migrate');
      return false;
    }
    
    const oldKeys = JSON.parse(oldKeysStr);
    
    // Store in secure storage
    await storeKeysSecurely(userId, oldKeys);
    
    // Remove old insecure storage
    await AsyncStorage.removeItem(`vanishvoice_keys_${userId}`);
    
    console.log('[SecureKeyStorage] Migration completed successfully');
    return true;
  } catch (error) {
    console.error('[SecureKeyStorage] Migration failed:', error);
    return false;
  }
};

// Initialize device ID if not exists
export const initializeDeviceId = async (): Promise<void> => {
  const existingId = await AsyncStorage.getItem('device_id');
  if (!existingId) {
    const randomBytes = await Crypto.getRandomBytesAsync(16);
    const deviceId = Buffer.from(randomBytes).toString('hex');
    await AsyncStorage.setItem('device_id', deviceId);
    console.log('[SecureKeyStorage] Device ID initialized');
  }
};

/**
 * Production Implementation with react-native-keychain:
 * 
 * import * as Keychain from 'react-native-keychain';
 * 
 * export const storeKeysInKeychain = async (userId: string, keys: any) => {
 *   await Keychain.setInternetCredentials(
 *     'vanishvoice.keys',
 *     userId,
 *     JSON.stringify(keys),
 *     {
 *       accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
 *       authenticatePrompt: 'Authenticate to access VanishVoice keys',
 *       authenticationPromptType: Keychain.AUTHENTICATION_TYPE.BIOMETRICS,
 *     }
 *   );
 * };
 */