/**
 * Secure E2E Audio Storage
 * 
 * This module provides end-to-end encrypted storage for voice messages
 * following the same security model as text messages.
 */

import { supabase } from '../services/supabase';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import SharedSecretEncryption from './sharedSecretEncryption';

export interface E2EEncryptedUploadResult {
  path: string;
  encryptedKey: string; // The audio key encrypted with recipient's shared secret
  nonce: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Generate a random encryption key for audio
 */
async function generateAudioKey(): Promise<string> {
  const keyBytes = await Crypto.getRandomBytesAsync(32); // 256-bit key
  return Buffer.from(keyBytes).toString('base64');
}

/**
 * Encrypt audio data using AES-like algorithm with proper binary handling
 */
async function encryptAudioData(
  base64Audio: string,
  key: string
): Promise<{ encrypted: string; nonce: string }> {
  // Generate nonce
  const nonceBytes = await Crypto.getRandomBytesAsync(16);
  const nonce = Buffer.from(nonceBytes).toString('base64');
  
  // Create encryption key by hashing key + nonce
  const encryptionKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key + nonce,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  
  // Convert audio to buffer
  const audioBuffer = Buffer.from(base64Audio, 'base64');
  const keyBuffer = Buffer.from(encryptionKey, 'hex');
  
  // Stream cipher encryption (XOR with key stretching)
  const encrypted = Buffer.alloc(audioBuffer.length);
  
  // Use counter mode for better security
  for (let i = 0; i < audioBuffer.length; i += keyBuffer.length) {
    // Create unique key for this block
    const blockKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      encryptionKey + i.toString(),
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    const blockKeyBuffer = Buffer.from(blockKey, 'hex');
    
    // XOR this block
    for (let j = 0; j < keyBuffer.length && (i + j) < audioBuffer.length; j++) {
      encrypted[i + j] = audioBuffer[i + j] ^ blockKeyBuffer[j];
    }
  }
  
  return {
    encrypted: encrypted.toString('base64'),
    nonce
  };
}

/**
 * Decrypt audio data
 */
async function decryptAudioData(
  encryptedBase64: string,
  key: string,
  nonce: string
): Promise<string> {
  // Create decryption key
  const decryptionKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key + nonce,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
  const keyBuffer = Buffer.from(decryptionKey, 'hex');
  
  // Stream cipher decryption
  const decrypted = Buffer.alloc(encryptedBuffer.length);
  
  // Use counter mode
  for (let i = 0; i < encryptedBuffer.length; i += keyBuffer.length) {
    // Create unique key for this block
    const blockKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      decryptionKey + i.toString(),
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    const blockKeyBuffer = Buffer.from(blockKey, 'hex');
    
    // XOR this block
    for (let j = 0; j < keyBuffer.length && (i + j) < encryptedBuffer.length; j++) {
      decrypted[i + j] = encryptedBuffer[i + j] ^ blockKeyBuffer[j];
    }
  }
  
  return decrypted.toString('base64');
}

/**
 * Upload E2E encrypted audio
 */
export const uploadE2EEncryptedAudio = async (
  localUri: string,
  senderId: string,
  recipientId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<E2EEncryptedUploadResult | null> => {
  try {
    // Create a unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filename = `${senderId}/${timestamp}_${randomId}.enc`;

    // Read the file
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file does not exist');
    }

    // Read file as base64
    const base64Audio = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Generate audio encryption key
    const audioKey = await generateAudioKey();
    
    // Encrypt the audio data
    const { encrypted: encryptedAudio, nonce: audioNonce } = await encryptAudioData(base64Audio, audioKey);
    
    // Derive shared secret for this friendship
    const sharedSecret = await SharedSecretEncryption.deriveSharedSecret(senderId, recipientId);
    
    // Encrypt the audio key with the shared secret
    const { encrypted: encryptedKey, nonce: keyNonce } = await SharedSecretEncryption.encrypt(audioKey, sharedSecret);
    
    // Convert encrypted audio to bytes for upload
    const encryptedBytes = Buffer.from(encryptedAudio, 'base64');

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .upload(filename, encryptedBytes, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    console.log('[E2EAudio] Encrypted audio uploaded successfully:', filename);
    
    // Return the path and encrypted key (not the plaintext key!)
    return {
      path: filename,
      encryptedKey: encryptedKey,
      nonce: JSON.stringify({ audioNonce, keyNonce }) // Store both nonces
    };
  } catch (error) {
    console.error('[E2EAudio] Error uploading encrypted audio:', error);
    return null;
  }
};

/**
 * Download and decrypt E2E encrypted audio
 */
export const downloadAndDecryptE2EAudio = async (
  path: string,
  encryptedKey: string,
  nonce: string,
  senderId: string,
  myUserId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<string | null> => {
  try {
    // Download the encrypted file
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .download(path);
    
    if (error) throw error;
    
    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        if (reader.result) {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to read blob'));
        }
      };
      reader.onerror = reject;
    });
    
    reader.readAsDataURL(data);
    const encryptedBase64 = await base64Promise;
    
    // Parse nonces
    const { audioNonce, keyNonce } = JSON.parse(nonce);
    
    // Derive shared secret
    const sharedSecret = await SharedSecretEncryption.deriveSharedSecret(myUserId, senderId);
    
    // Decrypt the audio key
    const audioKey = await SharedSecretEncryption.decrypt(encryptedKey, keyNonce, sharedSecret);
    
    // Decrypt the audio
    const decryptedBase64 = await decryptAudioData(encryptedBase64, audioKey, audioNonce);
    
    // Save decrypted audio to cache
    const filename = `voice_${Date.now()}.mp4`;
    const localUri = `${FileSystem.cacheDirectory}${filename}`;
    
    await FileSystem.writeAsStringAsync(localUri, decryptedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Verify the file was written correctly
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    console.log('[E2EAudio] Decrypted file saved:', {
      uri: localUri,
      size: fileInfo.size,
      exists: fileInfo.exists
    });
    
    // Ensure proper file:// prefix for iOS
    if (Platform.OS === 'ios' && !localUri.startsWith('file://')) {
      return 'file://' + localUri;
    }
    
    return localUri;
  } catch (error) {
    console.error('[E2EAudio] Error downloading/decrypting audio:', error);
    return null;
  }
};