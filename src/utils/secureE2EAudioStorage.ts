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
 * Decrypt audio data - Optimized version
 */
async function decryptAudioData(
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
  
  // Stream cipher decryption with optimized key generation
  const decrypted = Buffer.alloc(encryptedBuffer.length);
  
  // Pre-compute block keys for better performance (trade memory for speed)
  const blockSize = baseKeyBuffer.length;
  const numBlocks = Math.ceil(encryptedBuffer.length / blockSize);
  const maxPrecomputedBlocks = Math.min(numBlocks, 50); // Limit memory usage
  
  if (numBlocks <= maxPrecomputedBlocks) {
    // Small files: pre-compute all block keys for maximum speed
    const blockKeys: Buffer[] = [];
    for (let blockIndex = 0; blockIndex < numBlocks; blockIndex++) {
      const blockKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        baseKey + (blockIndex * blockSize).toString(),
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      blockKeys.push(Buffer.from(blockKey, 'hex'));
    }
    
    // Decrypt all blocks
    for (let blockIndex = 0; blockIndex < numBlocks; blockIndex++) {
      const blockKeyBuffer = blockKeys[blockIndex];
      const startOffset = blockIndex * blockSize;
      
      for (let j = 0; j < blockSize && (startOffset + j) < encryptedBuffer.length; j++) {
        decrypted[startOffset + j] = encryptedBuffer[startOffset + j] ^ blockKeyBuffer[j];
      }
    }
  } else {
    // Large files: compute keys on-demand to limit memory usage
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
    const { audioNonce, keyNonce } = JSON.parse(nonce);
    
    // Derive shared secret
    const keyDecryptStart = Date.now();
    const sharedSecret = await SharedSecretEncryption.deriveSharedSecret(myUserId, senderId);
    
    // Decrypt the audio key
    const audioKey = await SharedSecretEncryption.decrypt(encryptedKey, keyNonce, sharedSecret);
    console.log(`[E2EAudio] Key decryption completed in ${Date.now() - keyDecryptStart}ms`);
    
    // Decrypt the audio
    const audioDecryptStart = Date.now();
    const decryptedBase64 = await decryptAudioData(encryptedBase64, audioKey, audioNonce);
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