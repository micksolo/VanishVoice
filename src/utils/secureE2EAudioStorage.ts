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
 * Simple XOR encryption - optimized for performance
 */
function xorEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  const keyLen = key.length;
  
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % keyLen];
  }
  
  return result;
}

/**
 * Encrypt audio data using fast XOR encryption
 */
async function encryptAudioData(
  base64Audio: string,
  key: string
): Promise<{ encrypted: string; nonce: string }> {
  // Generate nonce (still needed for additional security)
  const nonceBytes = await Crypto.getRandomBytesAsync(16);
  const nonce = Buffer.from(nonceBytes).toString('base64');
  
  // Create encryption key by hashing key + nonce (one-time operation)
  const encryptionKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key + nonce,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  
  // Convert to Uint8Array for fast XOR
  const audioData = new Uint8Array(Buffer.from(base64Audio, 'base64'));
  const keyData = new Uint8Array(Buffer.from(encryptionKey, 'hex'));
  
  // Fast XOR encryption
  const encrypted = xorEncrypt(audioData, keyData);
  
  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    nonce
  };
}

/**
 * Legacy decryption for backward compatibility
 */
async function decryptAudioDataLegacy(
  encryptedBase64: string,
  key: string,
  nonce: string
): Promise<string> {
  // Create base decryption key
  const baseKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key + nonce,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
  const baseKeyBuffer = Buffer.from(baseKey, 'hex');
  
  // Stream cipher decryption
  const decrypted = Buffer.alloc(encryptedBuffer.length);
  const blockSize = baseKeyBuffer.length;
  
  for (let i = 0; i < encryptedBuffer.length; i += blockSize) {
    const blockKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      baseKey + i.toString(),
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    const blockKeyBuffer = Buffer.from(blockKey, 'hex');
    
    // XOR this block
    for (let j = 0; j < blockSize && (i + j) < encryptedBuffer.length; j++) {
      decrypted[i + j] = encryptedBuffer[i + j] ^ blockKeyBuffer[j];
    }
  }
  
  return decrypted.toString('base64');
}

/**
 * Decrypt audio data - Fast XOR version with legacy support
 */
async function decryptAudioData(
  encryptedBase64: string,
  key: string,
  nonce: string,
  onProgress?: (progress: number) => void,
  version: number = 1
): Promise<string> {
  const startTime = Date.now();
  
  // If version 1, go straight to legacy decryption
  if (version === 1) {
    console.log('[E2EAudio] Version 1 message detected, using legacy decryption');
    return decryptAudioDataLegacy(encryptedBase64, key, nonce);
  }
  
  // Try fast XOR decryption for v2+ messages
  try {
    // Create decryption key (one-time operation)
    const decryptionKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      key + nonce,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    
    // Convert to Uint8Array for fast XOR
    const encryptedData = new Uint8Array(Buffer.from(encryptedBase64, 'base64'));
    const keyData = new Uint8Array(Buffer.from(decryptionKey, 'hex'));
    
    console.log(`[E2EAudio] Starting XOR decryption of ${(encryptedData.length / 1024 / 1024).toFixed(2)}MB`);
    
    // Process in chunks to keep UI responsive
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(encryptedData.length / CHUNK_SIZE);
    const decrypted = new Uint8Array(encryptedData.length);
    
    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const start = chunk * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, encryptedData.length);
      
      // XOR decrypt this chunk
      for (let i = start; i < end; i++) {
        decrypted[i] = encryptedData[i] ^ keyData[i % keyData.length];
      }
      
      // Report progress (less frequently for better performance)
      if (onProgress && (chunk === 0 || chunk === totalChunks - 1 || chunk % 10 === 0)) {
        onProgress((chunk + 1) / totalChunks);
      }
    }
    
    const decryptionTime = Date.now() - startTime;
    console.log(`[E2EAudio] XOR decryption completed in ${decryptionTime}ms`);
    
    const result = Buffer.from(decrypted).toString('base64');
    
    // For v2 messages, skip validation since we know they use XOR
    if (version >= 2) {
      return result;
    }
    
    // For unknown versions, validate the result
    try {
      const testBuffer = Buffer.from(result.substring(0, 100), 'base64');
      if (testBuffer.length > 0) {
        return result;
      }
    } catch (validationError) {
      console.log('[E2EAudio] Fast decryption validation failed, trying legacy method');
    }
  } catch (error) {
    console.log('[E2EAudio] Fast decryption failed, trying legacy method:', error);
  }
  
  // Fall back to legacy decryption for old messages
  console.log('[E2EAudio] Using legacy decryption method');
  return decryptAudioDataLegacy(encryptedBase64, key, nonce);
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
      nonce: JSON.stringify({ audioNonce, keyNonce, version: 2 }) // Store both nonces and version
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
  const startTime = Date.now();
  try {
    console.log('[E2EAudio] Starting download and decrypt...');
    
    // Download the encrypted file
    const downloadStart = Date.now();
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .download(path);
    
    console.log(`[E2EAudio] Download completed in ${Date.now() - downloadStart}ms`);
    
    if (error) throw error;
    
    // Convert blob to base64 - optimized approach with React Native compatibility
    let encryptedData: Uint8Array;
    
    // Check if we have arrayBuffer method (web) or need to use FileReader (React Native)
    if (data.arrayBuffer) {
      const arrayBuffer = await data.arrayBuffer();
      encryptedData = new Uint8Array(arrayBuffer);
    } else {
      // React Native path - use FileReader
      const reader = new FileReader();
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to read blob as ArrayBuffer'));
          }
        };
        reader.onerror = () => reject(new Error('FileReader error: ' + reader.error?.message));
        reader.readAsArrayBuffer(data);
      });
      encryptedData = new Uint8Array(arrayBuffer);
    }
    
    const encryptedBase64 = Buffer.from(encryptedData).toString('base64');
    
    // Parse nonces
    const nonceData = JSON.parse(nonce);
    const { audioNonce, keyNonce, version = 1 } = nonceData;
    
    // Derive shared secret
    const keyDecryptStart = Date.now();
    const sharedSecret = await SharedSecretEncryption.deriveSharedSecret(myUserId, senderId);
    
    // Decrypt the audio key
    const audioKey = await SharedSecretEncryption.decrypt(encryptedKey, keyNonce, sharedSecret);
    console.log(`[E2EAudio] Key decryption completed in ${Date.now() - keyDecryptStart}ms`);
    
    // Decrypt the audio
    const audioDecryptStart = Date.now();
    const decryptedBase64 = await decryptAudioData(
      encryptedBase64, 
      audioKey, 
      audioNonce,
      (progress) => {
        // Map decryption progress to overall progress (50% to 90%)
        const overallProgress = 0.5 + (progress * 0.4);
        onProgress?.({ loaded: overallProgress * 100, total: 100, percentage: overallProgress * 100 });
      },
      version
    );
    console.log(`[E2EAudio] Audio decryption completed in ${Date.now() - audioDecryptStart}ms`);
    
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
    
    console.log(`[E2EAudio] Total process completed in ${Date.now() - startTime}ms`);
    
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