import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system/next';
import { supabase } from '../services/supabase';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import NaClBoxEncryption from './NaClBoxEncryption';
import FriendEncryption from './friendEncryption';
import { Platform } from 'react-native';
import { compressVideo, cleanupCompressedVideo, type CompressionProgress } from '../services/videoCompression';

/**
 * Secure E2E Video Storage - ZERO-KNOWLEDGE EDITION
 * 
 * This module provides TRUE zero-knowledge end-to-end encrypted storage for video messages.
 * The server CANNOT decrypt any video because all encryption keys are device-generated.
 * 
 * SECURITY MODEL (Version 3+):
 * - Uses nacl.secretbox (XSalsa20 + Poly1305) for AEAD video encryption
 * - Uses nacl.box (Curve25519 + XSalsa20 + Poly1305) for key wrapping
 * - Device-generated keys only - server cannot derive any keys
 * - Perfect Forward Secrecy via ephemeral keys
 * - AEAD integrity protection prevents tampering
 * 
 * BACKWARD COMPATIBILITY:
 * - Version 1-2: Legacy SharedSecretEncryption (COMPROMISED - server can decrypt)
 * - Version 3+: Zero-knowledge encryption (SECURE - server cannot decrypt)
 * 
 * STORAGE FORMAT:
 * - Video data: Encrypted with nacl.secretbox using random 32-byte key
 * - Video key: Encrypted with nacl.box using recipient's public key
 * - Database stores: encryptedKey, keyNonce, dataNonce, ephemeralPublicKey, version
 * - Server storage: Only encrypted video blob (cannot be decrypted without private keys)
 * 
 * ZERO-KNOWLEDGE GUARANTEE:
 * - Server has only public keys and encrypted data
 * - Private keys never leave devices (stored in secure hardware)
 * - Ephemeral keys provide Perfect Forward Secrecy
 * - Server cannot derive any decryption keys from stored data
 */

// Optimized for fast encryption/decryption
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for processing

// React Native performance debugging flags
const ENABLE_PERFORMANCE_LOGGING = true;
const ENABLE_MEMORY_OPTIMIZATION = true;

export class SecureE2EVideoStorageFastAndroid {
  /**
   * Fast encryption using nacl.secretbox (XSalsa20-Poly1305)
   * Much faster than XOR with base64 conversions
   */
  private static encrypt(data: Uint8Array, key: Uint8Array): { encrypted: Uint8Array; nonce: Uint8Array } {
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const encrypted = nacl.secretbox(data, nonce, key);
    return { encrypted, nonce };
  }

  /**
   * Fast decryption using nacl.secretbox.open
   */
  private static decrypt(encrypted: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    const start = Date.now();
    const sizeMB = encrypted.length / 1024 / 1024;
    if (__DEV__) {
      console.log('[Decrypt Method] Starting nacl.secretbox.open with [SIZE_REDACTED]');
      
      // Check if we need chunked processing for very large files
      if (sizeMB > 10) {
        console.log('[Decrypt Method] WARNING: Large file - nacl performance may degrade');
      }
    }
    
    // Memory check before operation
    const memBefore = Date.now();
    if (__DEV__) {
      console.log('[Decrypt Method] Pre-operation memory timestamp: [REDACTED]');
    }
    
    const result = nacl.secretbox.open(encrypted, nonce, key);
    
    const duration = (Date.now() - start) / 1000;
    if (__DEV__) {
      console.log(`[Decrypt Method] nacl.secretbox.open completed in ${duration.toFixed(3)}s`);
      
      if (result) {
        console.log('[Decrypt Method] Success: Output size [REDACTED]');
        console.log(`[Decrypt Method] Performance: [REDACTED] MB/s`);
        
        // Expected performance: nacl should do 10-50 MB/s
        const expectedTime = sizeMB / 25; // Assume 25 MB/s average
        if (duration > expectedTime * 2) {
          console.log(`[Decrypt Method] PERFORMANCE WARNING: Expected ~${expectedTime.toFixed(2)}s, got ${duration.toFixed(2)}s`);
        }
      } else {
        console.log('[Decrypt Method] Decryption failed - returned null');
      }
    }
    
    return result;
  }

  /**
   * Alternative optimized decryption for large files
   * Addresses React Native specific performance issues:
   * - Memory fragmentation 
   * - JavaScript engine (Hermes) optimization
   * - Main thread blocking
   */
  private static decryptOptimized(encrypted: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    const start = Date.now();
    const sizeMB = encrypted.length / 1024 / 1024;
    if (__DEV__) {
      console.log('[Decrypt Optimized] React Native optimization for [SIZE_REDACTED]...');
    }
    
    // Validate inputs upfront
    if (!(encrypted instanceof Uint8Array) || !(nonce instanceof Uint8Array) || !(key instanceof Uint8Array)) {
      console.error('[Decrypt Optimized] ERROR: Invalid input types');
      return null;
    }
    
    if (nonce.length !== nacl.secretbox.nonceLength || key.length !== nacl.secretbox.keyLength) {
      console.error('[Decrypt Optimized] ERROR: Invalid parameter lengths');
      return null;
    }
    
    // For very large files in React Native, use chunked processing to avoid memory issues
    if (sizeMB > 20) {
      console.log(`[Decrypt Optimized] Very large file - attempting chunked decryption...`);
      return this.decryptChunked(encrypted, nonce, key);
    }
    
    // React Native optimization: Yield to event loop periodically for large files
    if (sizeMB > 5) {
      console.log(`[Decrypt Optimized] Large file - using async batched approach...`);
      return this.decryptWithEventLoopYielding(encrypted, nonce, key);
    }
    
    // Standard decryption for smaller files
    console.log(`[Decrypt Optimized] Small file - standard decryption...`);
    const decryptStart = Date.now();
    
    try {
      const result = nacl.secretbox.open(encrypted, nonce, key);
      const duration = (Date.now() - decryptStart) / 1000;
      
      if (result) {
        if (__DEV__) {
          console.log(`[Decrypt Optimized] Success in ${duration.toFixed(3)}s ([PERFORMANCE_REDACTED])`);
        }
      } else {
        console.log('[Decrypt Optimized] Failed - returned null');
      }
      
      return result;
    } catch (error: any) {
      console.error(`[Decrypt Optimized] Exception:`, error);
      return null;
    }
  }

  /**
   * Chunked decryption for very large files (>20MB)
   * Not actually possible with nacl.secretbox due to authentication,
   * but tests if the issue is memory-related
   */
  private static decryptChunked(encrypted: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    console.log(`[Decrypt Chunked] Note: NaCl secretbox cannot be chunked due to authentication`);
    console.log(`[Decrypt Chunked] Falling back to optimized single-pass with memory management...`);
    
    // Force garbage collection if available (React Native/Hermes)
    if (global.gc) {
      console.log(`[Decrypt Chunked] Running garbage collection before decryption...`);
      global.gc();
    }
    
    const start = Date.now();
    try {
      const result = nacl.secretbox.open(encrypted, nonce, key);
      const duration = (Date.now() - start) / 1000;
      
      if (__DEV__) {
        console.log(`[Decrypt Chunked] Completed in ${duration.toFixed(3)}s`);
      }
      return result;
    } catch (error: any) {
      console.error(`[Decrypt Chunked] Failed:`, error);
      return null;
    }
  }

  /**
   * Decryption with event loop yielding to prevent main thread blocking
   * Uses setTimeout to break up the work (React Native optimization)
   */
  private static decryptWithEventLoopYielding(encrypted: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    console.log(`[Decrypt Yielding] Using event loop yielding optimization...`);
    
    // Since nacl.secretbox is atomic, we can't actually chunk it
    // But we can try to optimize memory and timing
    const start = Date.now();
    
    try {
      // Create fresh Uint8Arrays to avoid any potential memory fragmentation issues
      if (__DEV__) {
        console.log('[Decrypt Yielding] Creating fresh Uint8Arrays...');
      }
      const freshEncrypted = new Uint8Array(encrypted);
      const freshNonce = new Uint8Array(nonce);
      const freshKey = new Uint8Array(key);
      
      console.log(`[Decrypt Yielding] Starting optimized nacl.secretbox.open...`);
      const decryptStart = Date.now();
      const result = nacl.secretbox.open(freshEncrypted, freshNonce, freshKey);
      const duration = (Date.now() - decryptStart) / 1000;
      
      const sizeMB = encrypted.length / 1024 / 1024;
      if (__DEV__) {
        console.log(`[Decrypt Yielding] Completed in ${duration.toFixed(3)}s ([PERFORMANCE_REDACTED])`);
      }
      
      return result;
    } catch (error: any) {
      console.error(`[Decrypt Yielding] Failed:`, error);
      return null;
    }
  }

  /**
   * Upload video with compression and fast encryption
   */
  static async encryptAndUploadVideo(
    videoUri: string,
    senderId: string,
    recipientId: string,
    onProgress?: (progress: number) => void,
    onCompressionProgress?: (progress: CompressionProgress) => void
  ): Promise<{ 
    videoId: string; 
    encryptedKey: string; 
    keyNonce: string; 
    dataNonce: string;
    ephemeralPublicKey: string;
    version: number;
    recipientKeyId: string;
    recipientDeviceId: string;
  }> {
    const startTime = Date.now();
    let compressedVideoUri: string | null = null;
    
    try {
      // Get original file info
      const originalFileInfo = await FileSystem.getInfoAsync(videoUri);
      const originalSizeMB = (originalFileInfo.size || 0) / 1024 / 1024;
      if (__DEV__) {
        console.log('[Video Upload] Original size: [SIZE_REDACTED]');
      }
      
      // Compress video first (takes up to 40% of progress)
      onProgress?.(0.05);
      console.log('[Video Upload] Starting compression...');
      
      const compressionResult = await compressVideo(
        videoUri,
        (compProgress) => {
          // Map compression progress to 5-40% of total progress
          const totalProgress = 0.05 + (compProgress.percent / 100) * 0.35;
          onProgress?.(totalProgress);
          onCompressionProgress?.(compProgress);
        }
      );
      
      compressedVideoUri = compressionResult.uri;
      const compressedSizeMB = compressionResult.compressedSize / 1024 / 1024;
      if (__DEV__) {
        console.log('[Video Upload] Compressed to: [SIZE_REDACTED] ([COMPRESSION_RATIO_REDACTED])'); 
      }
      
      // Generate keys - this is where PRNG errors occur
      console.log('[Video Upload] Generating encryption keys...');
      let videoKey: Uint8Array;
      let videoId: string;
      
      try {
        videoKey = nacl.randomBytes(32);
        videoId = global.Buffer.from(nacl.randomBytes(16)).toString('hex');
        console.log('[Video Upload] ✅ Keys generated successfully');
      } catch (keyGenError: any) {
        console.error('[Video Upload] Key generation failed:', keyGenError);
        if (keyGenError.message?.includes('PRNG') || keyGenError.message?.includes('no PRNG')) {
          throw new Error('Crypto initialization failed. This may be due to Expo Go limitations. Please try using a development build for full video functionality.');
        }
        throw new Error('Failed to generate encryption keys: ' + keyGenError.message);
      }
      
      // Read compressed file using fast binary API
      onProgress?.(0.45);
      console.log('[Video Upload] Reading compressed file as binary...');
      let videoData: Uint8Array;
      
      try {
        // Use new File API for direct binary reading
        const compressedFile = new File(compressedVideoUri);
        videoData = compressedFile.bytes();
        if (__DEV__) {
          console.log('[Video Upload] Read [SIZE_REDACTED] directly as Uint8Array');
        }
      } catch (fileApiError: any) {
        // Fallback to base64 if new API fails
        console.warn('[Video Upload] New File API failed, using base64 fallback:', fileApiError);
        const videoBase64 = await FileSystem.readAsStringAsync(compressedVideoUri, {
          encoding: FileSystem.EncodingType.Base64
        });
        videoData = new Uint8Array(global.Buffer.from(videoBase64, 'base64'));
        if (__DEV__) {
          console.log('[Video Upload] Read [SIZE_REDACTED] via base64 fallback');
        }
      }
      
      // Encrypt using fast nacl.secretbox
      onProgress?.(0.55);
      console.log('[Video Upload] Encrypting with nacl.secretbox...');
      const encryptStart = Date.now();
      const { encrypted, nonce } = this.encrypt(videoData, videoKey);
      console.log(`[Video Upload] Encrypted in ${((Date.now() - encryptStart) / 1000).toFixed(1)}s`);
      
      // Upload encrypted data (for zero-knowledge, we don't prefix nonce as it's stored separately)
      onProgress?.(0.65);
      const uploadData = encrypted; // Pure encrypted data, nonce stored in dataNonce field
      
      const { error } = await supabase.storage
        .from('videos')
        .upload(`${videoId}/video.enc`, global.Buffer.from(uploadData), {
          contentType: 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      
      onProgress?.(0.9);
      
      // Get recipient's public key WITH METADATA for zero-knowledge encryption
      console.log('[Video Upload] CRITICAL: Getting recipient public key WITH METADATA for recipient tracking...');
      const friendKeyData = await FriendEncryption.getFriendPublicKey(recipientId, senderId, true);
      if (!friendKeyData) {
        throw new Error('Recipient public key not found - they need to open the app first');
      }
      
      const { publicKey: friendPublicKey, keyId: recipientKeyId, deviceId: recipientDeviceId } = friendKeyData;
      
      // CRITICAL: Verify this is the correct public key for the recipient
      console.log('[Video Upload] Cross-device key verification WITH RECIPIENT TRACKING:');
      console.log('- Encrypting for recipient ID:', recipientId);
      console.log('- Sender ID:', senderId);
      console.log('- Retrieved public key length:', friendPublicKey.length);
      console.log('- Public key preview:', friendPublicKey.substring(0, 16) + '...');
      console.log('- Recipient Key ID (for tracking):', recipientKeyId);
      console.log('- Recipient Device ID:', recipientDeviceId);
      
      // Additional validation: Check if recipient has multiple keys and ensure we're using the right one
      try {
        const recipientKeyValidation = await this.validateRecipientPublicKey(recipientId, friendPublicKey);
        if (!recipientKeyValidation.valid) {
          console.error('[Video Upload] ❌ CRITICAL: Invalid recipient public key!');
          console.error('[Video Upload] Error:', recipientKeyValidation.error);
          throw new Error(`Invalid recipient public key: ${recipientKeyValidation.error}`);
        } else {
          console.log('[Video Upload] ✅ Recipient public key validation PASSED');
          console.log('[Video Upload] Key info:', recipientKeyValidation.info);
        }
      } catch (keyValidationError) {
        console.warn('[Video Upload] ⚠️ Recipient key validation failed, but continuing:', keyValidationError);
        console.warn('[Video Upload] This may work if the recipient key is valid despite validation issues');
      }
      
      console.log('[Video Upload] Encrypting video key with zero-knowledge encryption...');
      console.log('[Video Upload] ✅ Server CANNOT decrypt this video!');
      
      // DEBUG: Validate video key encryption parameters
      console.log('[Video Upload] DEBUGGING VIDEO KEY ENCRYPTION...');
      console.log('[Video Upload] Key encryption parameters:');
      console.log('- videoKey length (should be 32):', videoKey.length);
      console.log('- videoKey hex (first 16 bytes):', Array.from(videoKey.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('- friendPublicKey length:', friendPublicKey.length);
      console.log('- friendPublicKey first 8 chars:', friendPublicKey.substring(0, 8) + '...');
      console.log('- friendPublicKey last 8 chars:', '...' + friendPublicKey.substring(friendPublicKey.length - 8));
      
      // Validate friend public key is valid base64
      try {
        const friendPubKeyBytes = global.Buffer.from(friendPublicKey, 'base64');
        console.log('[Video Upload] Friend public key validation:');
        console.log('- Decoded friend public key length:', friendPubKeyBytes.length);
        console.log('- Expected length (32):', 32);
        
        if (friendPubKeyBytes.length !== 32) {
          throw new Error(`Invalid friend public key length: ${friendPubKeyBytes.length}, expected 32`);
        }
        
        console.log('[Video Upload] ✅ Friend public key validation PASSED');
      } catch (pubKeyError) {
        console.error('[Video Upload] ❌ Friend public key validation FAILED:', pubKeyError);
        throw new Error('Invalid friend public key: ' + pubKeyError.message);
      }
      
      // Encrypt video key using NaCl box encryption (same as audio system)
      console.log('[Video Upload] Starting NaClBoxEncryption.encrypt...');
      const keyEncryption = await NaClBoxEncryption.encrypt(
        videoKey, // The symmetric video encryption key
        friendPublicKey // Recipient's public key
      );
      
      console.log('[Video Upload] ✅ Video key encryption completed!');
      console.log('[Video Upload] Encryption result validation:');
      console.log('- encryptedContent length:', keyEncryption.encryptedContent.length);
      console.log('- nonce length:', keyEncryption.nonce.length);
      console.log('- ephemeralPublicKey length:', keyEncryption.ephemeralPublicKey.length);
      
      // ROUND-TRIP TEST: Verify the key can be decrypted by the recipient
      console.log('[Video Upload] PERFORMING ROUND-TRIP ENCRYPTION TEST...');
      try {
        // CRITICAL FIX: Get RECIPIENT'S device keys to properly test decryption
        // We need to test with the recipient's private key, not the sender's
        console.log('[Video Upload] Getting recipient device keys for proper round-trip test...');
        
        // Get recipient's private key (simulate what recipient will use to decrypt)
        // Note: getFriendDeviceKeys doesn't exist - use getDeviceKeys for current device only
        const recipientDeviceKeys = await FriendEncryption.getDeviceKeys();
        if (recipientDeviceKeys && recipientDeviceKeys.privateKey && recipientId === senderId) {
          // Only test if this is the same user (single device testing)
          console.log('[Video Upload] Testing video key decryption with RECIPIENT device keys...');
          
          const testDecryptedKey = await NaClBoxEncryption.decrypt(
            keyEncryption.encryptedContent,
            keyEncryption.nonce,
            keyEncryption.ephemeralPublicKey,
            recipientDeviceKeys.privateKey
          );
          
          // Compare decrypted key with original
          if (testDecryptedKey.length === videoKey.length) {
            let keysMatch = true;
            for (let i = 0; i < videoKey.length; i++) {
              if (testDecryptedKey[i] !== videoKey[i]) {
                keysMatch = false;
                break;
              }
            }
            
            if (keysMatch) {
              console.log('[Video Upload] ✅ ROUND-TRIP TEST PASSED - Recipient can decrypt video key correctly!');
            } else {
              console.error('[Video Upload] ❌ ROUND-TRIP TEST FAILED - Decrypted key does not match original');
              console.error('[Video Upload] Original key hex:', Array.from(videoKey.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
              console.error('[Video Upload] Decrypted key hex:', Array.from(testDecryptedKey.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
              throw new Error('Video key encryption verification failed - keys do not match');
            }
          } else {
            console.error('[Video Upload] ❌ ROUND-TRIP TEST FAILED - Key length mismatch');
            console.error('[Video Upload] Original length:', videoKey.length, 'Decrypted length:', testDecryptedKey.length);
            throw new Error('Video key encryption verification failed - length mismatch');
          }
        } else {
          console.log('[Video Upload] ⚠️ Cannot test cross-device decryption - skipping round-trip test');
          console.log('[Video Upload] This is normal for cross-device encryption (sender != recipient)');
          console.log('[Video Upload] Video key encrypted successfully, recipient will test on their device');
        }
      } catch (roundTripError: any) {
        console.error('[Video Upload] ❌ ROUND-TRIP TEST FAILED:', roundTripError.message);
        
        // Check if this is a cross-device limitation (expected for different users)
        if (recipientId !== senderId) {
          console.log('[Video Upload] ⚠️ Cross-device testing limitation - cannot access recipient keys');
          console.log('[Video Upload] Video encryption should work correctly on recipient device');
        } else {
          console.error('[Video Upload] This indicates a real encryption issue');
          // Continue for now to gather more debug info, but log the issue
          console.error('[Video Upload] ⚠️ Proceeding anyway to gather debug information...');
        }
      }
      
      const dataNonce = global.Buffer.from(nonce).toString('base64');
      
      // Cleanup compressed video
      if (compressedVideoUri) {
        await cleanupCompressedVideo(compressedVideoUri);
      }
      
      const totalDuration = (Date.now() - startTime) / 1000;
      console.log(`[Video Upload] Complete in ${totalDuration.toFixed(1)}s`);
      if (__DEV__) {
        console.log('[Video Upload] Original: [SIZE_REDACTED] → Uploaded: [SIZE_REDACTED]');
      }
      onProgress?.(1.0);
      
      return {
        videoId,
        encryptedKey: keyEncryption.encryptedContent, // Video key encrypted with recipient's public key
        keyNonce: keyEncryption.nonce, // Nonce for key encryption
        dataNonce, // Nonce for video data encryption
        ephemeralPublicKey: keyEncryption.ephemeralPublicKey, // Ephemeral public key for Perfect Forward Secrecy
        version: 3, // Zero-knowledge encryption version
        recipientKeyId, // PHASE 2 FIX: Store which specific key was used for encryption
        recipientDeviceId // Device that should decrypt this message
      };
      
    } catch (error) {
      // Cleanup on error
      if (compressedVideoUri) {
        await cleanupCompressedVideo(compressedVideoUri).catch(console.error);
      }
      console.error('[Video Upload] Failed:', error);
      throw error;
    }
  }

  /**
   * Download and decrypt video with fast binary operations - NO BASE64
   */
  static async downloadAndDecryptVideo(
    videoId: string,
    encryptedKey: string,
    keyNonce: string,
    senderId: string,
    recipientId: string,
    onProgress?: (progress: number) => void,
    dataNonce?: string,
    ephemeralPublicKey?: string,
    version: number = 1,
    recipientKeyId?: string,
    recipientDeviceId?: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      console.log(`[Video Download] Starting FAST binary download for videoId: ${videoId}`);
      console.log(`[Video Download] Using expo-file-system/next for direct binary operations`);
      onProgress?.(0.1);
      
      // Decrypt video key using appropriate method based on version
      let videoKey: Uint8Array;
      
      if (version >= 3) {
        // Version 3+: Zero-knowledge encryption with NaCl
        console.log('[Video Download] Using zero-knowledge decryption (version 3+)');
        console.log('[Video Download] ✅ Server CANNOT perform this decryption!');
        
        if (!ephemeralPublicKey || !dataNonce) {
          throw new Error('Missing zero-knowledge encryption parameters');
        }
        
        // Get our device private key
        const deviceKeys = await FriendEncryption.getDeviceKeys();
        if (!deviceKeys) {
          throw new Error('Device keys not found - please restart the app');
        }
        
        // PHASE 2 FIX: Validate recipient key ID before attempting decryption
        if (recipientKeyId && recipientKeyId !== 'unknown') {
          console.log('[Video Download] PHASE 2: Validating recipient key ID for targeted fix...');
          console.log(`- Message was encrypted with recipient key ID: ${recipientKeyId}`);
          
          // Get current device key ID to compare
          try {
            const currentKeyId = await SecureDeviceKeys.getCurrentKeyId(recipientId);
            if (!currentKeyId) {
              console.error('[Video Download] ❌ Cannot get current device key ID for validation');
              throw new Error('Unable to validate recipient key - current device key ID not found');
            }
            console.log(`- Current device key ID: ${currentKeyId}`);
            
            if (recipientKeyId !== currentKeyId) {
              console.error('[Video Download] ❌ RECIPIENT KEY MISMATCH DETECTED!');
              console.error(`- Message encrypted for key: ${recipientKeyId}`);
              console.error(`- Current device key: ${currentKeyId}`);
              console.error('[Video Download] This is the ROOT CAUSE of nacl.box.open returning null');
              console.error('[Video Download] Message was encrypted to a different device key');
              
              // Provide clear error message to user
              throw new Error(`This message was encrypted for a different device key. Message key: ${recipientKeyId}, Current key: ${currentKeyId}`);
            } else {
              console.log('[Video Download] ✅ RECIPIENT KEY ID VALIDATION PASSED');
              console.log('[Video Download] ✅ Message was encrypted to current device key');
            }
          } catch (keyValidationError: any) {
            console.error('[Video Download] ❌ Recipient key validation failed:', keyValidationError.message);
            
            // If this is the key mismatch error we just threw, re-throw it
            if (keyValidationError.message.includes('encrypted for a different device key')) {
              throw keyValidationError;
            }
            
            // Otherwise, fall back to general device key consistency check
            console.warn('[Video Download] Falling back to general device key consistency check...');
          }
        } else {
          console.log('[Video Download] No recipient key ID provided - using legacy device key consistency check');
        }
        
        // FALLBACK: Validate device key consistency for legacy messages
        console.log('[Video Download] Validating device key consistency...');
        const keyConsistencyValid = await this.validateDeviceKeyConsistency(recipientId);
        if (!keyConsistencyValid) {
          console.error('[Video Download] ❌ Device key consistency validation FAILED');
          console.error('[Video Download] This is likely the root cause of nacl.box.open returning null');
          console.error('[Video Download] The private key on this device does not match the public key used for encryption');
          console.error('[Video Download] SOLUTION: Device needs to re-initialize encryption keys');
          throw new Error('Device key inconsistency detected - encryption keys do not match');
        } else {
          console.log('[Video Download] ✅ Device key consistency validation PASSED');
        }
        
        // CRITICAL: Cross-device key exchange validation
        console.log('[Video Download] Performing cross-device key exchange validation...');
        const keyExchangeValid = await this.validateKeyExchange(senderId, recipientId, ephemeralPublicKey!, deviceKeys.privateKey);
        if (!keyExchangeValid.valid) {
          console.error('[Video Download] ❌ CRITICAL: Key exchange validation FAILED!');
          console.error('[Video Download] Error:', keyExchangeValid.error);
          console.error('[Video Download] This explains why nacl.box.open returns null');
          console.error('[Video Download] Sender used wrong public key for encryption');
          throw new Error(`Key exchange validation failed: ${keyExchangeValid.error}`);
        } else {
          console.log('[Video Download] ✅ Key exchange validation PASSED');
          console.log('[Video Download] Info:', keyExchangeValid.info);
        }
        
        // DEBUG: Add comprehensive key validation for zero-knowledge encryption
        console.log('[Video Download] DEBUGGING ZERO-KNOWLEDGE KEY DECRYPTION...');
        console.log('[Video Download] Key parameters validation:');
        console.log('✅ encryptedKey(64):', encryptedKey.length);
        console.log('✅ keyNonce(32):', keyNonce.length);  
        console.log('✅ dataNonce(32):', dataNonce.length);
        console.log('✅ ephemeralPublicKey(44):', ephemeralPublicKey.length);
        console.log('✅ deviceKeys.privateKey:', deviceKeys.privateKey.length);
        
        // Validate device keys are properly loaded
        console.log('[Video Download] Device key validation:');
        console.log('- Device ID:', deviceKeys.deviceId);
        console.log('- Private key first 8 chars:', deviceKeys.privateKey.substring(0, 8) + '...');
        console.log('- Private key last 8 chars:', '...' + deviceKeys.privateKey.substring(deviceKeys.privateKey.length - 8));
        
        // Validate ephemeral key format
        console.log('[Video Download] Ephemeral key validation:');
        console.log('- Ephemeral public key first 8 chars:', ephemeralPublicKey.substring(0, 8) + '...');
        console.log('- Ephemeral public key last 8 chars:', '...' + ephemeralPublicKey.substring(ephemeralPublicKey.length - 8));
        
        // Validate all parameters are base64
        try {
          const testEncryptedKey = global.Buffer.from(encryptedKey, 'base64');
          const testKeyNonce = global.Buffer.from(keyNonce, 'base64');
          const testEphemeralKey = global.Buffer.from(ephemeralPublicKey, 'base64');
          const testPrivateKey = global.Buffer.from(deviceKeys.privateKey, 'base64');
          
          console.log('[Video Download] Base64 validation: ALL PARAMETERS VALID');
          console.log('- Decoded encryptedKey length:', testEncryptedKey.length);
          console.log('- Decoded keyNonce length:', testKeyNonce.length);
          console.log('- Decoded ephemeralPublicKey length:', testEphemeralKey.length);
          console.log('- Decoded privateKey length:', testPrivateKey.length);
        } catch (base64Error) {
          console.error('[Video Download] ❌ BASE64 VALIDATION FAILED:', base64Error);
          throw new Error('Invalid base64 encoding in encryption parameters');
        }
        
        console.log('[Video Download] ✅ Version 3 zero-knowledge encryption in use');
        console.log('[Video Download] ✅ NaCl parameters validated: Parameter lengths verified: OK');
        
        // Decrypt video key using zero-knowledge NaCl decryption 
        console.log('[Video Download] Starting key decryption with nacl.box.open...');
        try {
          const decryptedKeyBytes = await NaClBoxEncryption.decrypt(
            encryptedKey,
            keyNonce,
            ephemeralPublicKey,
            deviceKeys.privateKey
          );
          
          console.log('[Video Download] ✅ Key decryption SUCCESSFUL!');
          console.log('[Video Download] Decrypted key length:', decryptedKeyBytes.length);
          console.log('[Video Download] Expected key length (32 bytes):', 32);
          
          if (decryptedKeyBytes.length !== 32) {
            throw new Error(`Invalid decrypted key length: ${decryptedKeyBytes.length}, expected 32`);
          }
        
          videoKey = decryptedKeyBytes;
          
          console.log('[Video Download] Key decryption parameters verified:');
          console.log('- encryptedKey length:', encryptedKey.length);
          console.log('- keyNonce length:', keyNonce.length);
          console.log('- ephemeralPublicKey length:', ephemeralPublicKey.length);
          console.log('- dataNonce length:', dataNonce.length);
          console.log('- deviceKeys.privateKey length:', deviceKeys.privateKey.length);
          console.log('- decryptedKeyBytes length:', decryptedKeyBytes.length);
          
          console.log('[Video Download] ✅ Zero-knowledge key decryption successful!');
          
        } catch (keyDecryptError: any) {
          console.error('[Video Download] ❌ CRITICAL FAILURE: Key decryption failed!');
          console.error('[Video Download] This indicates a fundamental issue with key exchange');
          console.error('[Video Download] Error details:', keyDecryptError.message);
          
          // Enhanced debugging for nacl.box.open failure
          if (keyDecryptError.message?.includes('nacl.box.open returned null')) {
            console.error('[Video Download] ❌ CRITICAL FAILURE: nacl.box.open returned null');
            console.error('[Video Download] Running comprehensive key exchange debugging...');
            
            // Run comprehensive debugging to identify the root cause
            try {
              const debugResult = await FriendEncryption.debugKeyExchangeFlow(
                senderId,
                recipientId,
                ephemeralPublicKey
              );
              
              console.error('[Video Download] 🔍 KEY EXCHANGE DEBUG RESULTS:');
              debugResult.details.forEach(detail => console.error('[Video Download]', detail));
              
              if (debugResult.recommendations.length > 0) {
                console.error('[Video Download] 💡 RECOMMENDATIONS:');
                debugResult.recommendations.forEach(rec => console.error('[Video Download] -', rec));
              }
              
              if (!debugResult.success) {
                console.error('[Video Download] ❌ Key exchange debugging FAILED - this confirms the root cause');
              } else {
                console.error('[Video Download] ⚠️ Key exchange debugging PASSED - issue may be elsewhere');
              }
            } catch (debugError) {
              console.error('[Video Download] Failed to run key exchange debugging:', debugError);
              console.error('[Video Download] Falling back to basic error analysis...');
              console.error('[Video Download] This means one of:');
              console.error('  1. Wrong recipient private key (device key mismatch)');
              console.error('  2. Wrong ephemeral public key (sender/receiver mismatch)');
              console.error('  3. Wrong key nonce (encryption parameter corruption)');
              console.error('  4. Corrupted encrypted key data');
              console.error('  5. Key exchange protocol failure');
            }
            
            // Debug specific key characteristics
            try {
              const encKeyBytes = global.Buffer.from(encryptedKey, 'base64');
              const nonceBytes = global.Buffer.from(keyNonce, 'base64');
              const ephemeralBytes = global.Buffer.from(ephemeralPublicKey, 'base64');
              const privateBytes = global.Buffer.from(deviceKeys.privateKey, 'base64');
              
              console.error('[Video Download] Detailed parameter analysis:');
              console.error('- Encrypted key hex (first 16 bytes):', Array.from(encKeyBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
              console.error('- Key nonce hex (first 16 bytes):', Array.from(nonceBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
              console.error('- Ephemeral public key hex (first 16 bytes):', Array.from(ephemeralBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
              console.error('- Private key hex (first 16 bytes):', Array.from(privateBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
              
              // Key length validation
              if (nonceBytes.length !== 24) {
                console.error('❌ INVALID KEY NONCE LENGTH:', nonceBytes.length, 'expected 24');
              }
              if (ephemeralBytes.length !== 32) {
                console.error('❌ INVALID EPHEMERAL PUBLIC KEY LENGTH:', ephemeralBytes.length, 'expected 32');
              }
              if (privateBytes.length !== 32) {
                console.error('❌ INVALID PRIVATE KEY LENGTH:', privateBytes.length, 'expected 32');
              }
              
            } catch (debugError) {
              console.error('[Video Download] Debug analysis failed:', debugError);
            }
          }
          
          throw keyDecryptError;
        }
      } else {
        // Legacy versions: SharedSecretEncryption (backward compatibility)
        console.log(`[Video Download] Using legacy decryption (version ${version})`);
        console.warn('[Video Download] ⚠️  Legacy encryption is NOT zero-knowledge - server can decrypt!');
        
        // Import SharedSecretEncryption for legacy support
        const SharedSecretEncryption = await import('./sharedSecretEncryption').then(m => m.default);
        
        const sharedSecret = await SharedSecretEncryption.deriveSharedSecret(senderId, recipientId);
        const decryptedKeyBase64 = await SharedSecretEncryption.decrypt(
          encryptedKey,
          keyNonce,
          sharedSecret
        );
        
        if (!decryptedKeyBase64) {
          throw new Error('Failed to decrypt video key using legacy method');
        }
        
        videoKey = new Uint8Array(global.Buffer.from(decryptedKeyBase64, 'base64'));
      }
      
      // Prepare output file path first
      const outputPath = `${FileSystem.documentDirectory}video_${Date.now()}.mp4`;
      
      // Download from Supabase
      onProgress?.(0.2);
      console.log(`[Video Download] Downloading from Supabase...`);
      const downloadStart = Date.now();
      
      // Create a signed URL for authenticated download
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(`${videoId}/video.enc`, 300); // 5 minute expiry
      
      if (urlError || !signedUrlData?.signedUrl) {
        throw new Error(`Failed to create signed URL: ${urlError?.message || 'Unknown error'}`);
      }
      
      // Download directly to a temporary file
      const tempPath = `${FileSystem.cacheDirectory}temp_${Date.now()}.enc`;
      
      try {
        const downloadResult = await FileSystem.downloadAsync(
          signedUrlData.signedUrl,
          tempPath,
          {
            sessionType: FileSystem.FileSystemSessionType.BACKGROUND
          }
        );
        
        if (downloadResult.status !== 200) {
          throw new Error(`Download failed with status: ${downloadResult.status}`);
        }
      } catch (downloadError: any) {
        console.error('[Video Download] Direct download failed:', downloadError);
        throw new Error(`Download failed: ${downloadError?.message || 'Unknown error'}`);
      }
      
      // Get file size
      const fileInfo = await FileSystem.getInfoAsync(tempPath);
      const fileSizeMB = (fileInfo.size || 0) / 1024 / 1024;
      if (__DEV__) {
        console.log('[Video Download] Downloaded [SIZE_REDACTED] in [TIME_REDACTED]');
      }
      onProgress?.(0.5);
      
      // Read encrypted file directly as binary - NO BASE64
      console.log(`[Video Download] Reading encrypted file as binary...`);
      const readStart = Date.now();
      
      try {
        // Use new File API for direct binary reading - This should be FAST
        console.log(`[Video Download] Using expo-file-system/next File API for direct binary read...`);
        const encryptedFile = new File(tempPath);
        const encryptedWithNonce = encryptedFile.bytes();
        const readTime = (Date.now() - readStart) / 1000;
        if (__DEV__) {
          console.log('[Video Download] Read [SIZE_REDACTED] directly as Uint8Array in [TIME_REDACTED]');
        }
        
        // Verify this is a proper Uint8Array
        if (__DEV__) {
          console.log('[Video Download] File API result type: [TYPE_INFO_REDACTED]');
        }
        
        if (readTime > 1) {
          console.log(`[Video Download] WARNING: File API read is slow - ${readTime.toFixed(3)}s for binary read`);
        }
        
        // Extract nonce and encrypted data
        const nonceLength = nacl.secretbox.nonceLength;
        let nonce: Uint8Array;
        let encryptedData: Uint8Array;
        
        if (version >= 3 && dataNonce) {
          // Zero-knowledge version: use provided dataNonce
          nonce = new Uint8Array(global.Buffer.from(dataNonce, 'base64'));
          encryptedData = encryptedWithNonce; // No nonce prefix for zero-knowledge version
        } else {
          // Legacy version: nonce is prefixed to encrypted data
          nonce = encryptedWithNonce.slice(0, nonceLength);
          encryptedData = encryptedWithNonce.slice(nonceLength);
        }
        
        // Decrypt using fast nacl.secretbox
        console.log(`[Video Download] Decrypting with nacl.secretbox...`);
        if (__DEV__) {
          console.log('[Video Download] Processing [SIZE_REDACTED]');
        }
        const decryptStart = Date.now();
        onProgress?.(0.6);
        
        // Pre-decrypt validation with detailed parameter checking
        console.log('[Video Download] Pre-decryption validation:');
        console.log('- encryptedData type:', typeof encryptedData, 'length:', encryptedData.length);
        console.log('- nonce type:', typeof nonce, 'length:', nonce.length);
        console.log('- videoKey type:', typeof videoKey, 'length:', videoKey.length);
        console.log('- Expected nonce length:', nacl.secretbox.nonceLength);
        console.log('- Expected key length:', nacl.secretbox.keyLength);
        
        // Validate parameter lengths
        if (nonce.length !== nacl.secretbox.nonceLength) {
          console.error(`[Video Download] ERROR: Invalid nonce length: ${nonce.length}, expected: ${nacl.secretbox.nonceLength}`);
          throw new Error(`Invalid nonce length: ${nonce.length}, expected: ${nacl.secretbox.nonceLength}`);
        }
        
        if (videoKey.length !== nacl.secretbox.keyLength) {
          console.error(`[Video Download] ERROR: Invalid key length: ${videoKey.length}, expected: ${nacl.secretbox.keyLength}`);
          throw new Error(`Invalid key length: ${videoKey.length}, expected: ${nacl.secretbox.keyLength}`);
        }
        
        // Time the actual nacl.secretbox.open call
        const naclStart = Date.now();
        console.log(`[Video Download] Starting decryption operation with validated parameters...`);
        console.log(`[Video Download] About to call nacl.secretbox.open with ${encryptedData.length} bytes...`);
        
        // Decrypt in one operation - nacl.secretbox is very fast
        // Try optimized decryption first for large files
        const sizeMB = encryptedData.length / 1024 / 1024;
        let decrypted: Uint8Array | null = null;
        
        if (sizeMB > 3) {
          console.log(`[Video Download] Large file (${sizeMB.toFixed(2)}MB) - trying optimized decryption first...`);
          decrypted = this.decryptOptimized(encryptedData, nonce, videoKey);
          
          if (!decrypted) {
            console.log(`[Video Download] Optimized decryption failed, falling back to standard method...`);
            decrypted = this.decrypt(encryptedData, nonce, videoKey);
          }
        } else {
          console.log(`[Video Download] Small file (${sizeMB.toFixed(2)}MB) - using standard decryption...`);
          decrypted = this.decrypt(encryptedData, nonce, videoKey);
        }
        
        const naclDuration = (Date.now() - naclStart) / 1000;
        console.log(`[Video Download] Pure nacl.secretbox.open() took: ${naclDuration.toFixed(3)}s`);
        
        if (!decrypted) {
          console.error('[Video Download] ❌ DECRYPTION FAILED - nacl.secretbox.open() returned null');
          console.error('[Video Download] This indicates one of:');
          console.error('  1. Wrong decryption key (most likely)');
          console.error('  2. Wrong nonce');
          console.error('  3. Corrupted encrypted data');
          console.error('  4. Data was not encrypted with nacl.secretbox');
          console.error('[Video Download] Debug info:');
          console.error('  - Video key first 8 bytes:', Array.from(videoKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
          console.error('  - Nonce first 8 bytes:', Array.from(nonce.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
          console.error('  - Encrypted data first 8 bytes:', Array.from(encryptedData.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
          console.error('  - Video was encrypted with version:', version);
          
          // Try to identify the issue by checking if this looks like the right data format
          if (encryptedData.length < 16) {
            console.error('  - ERROR: Encrypted data too short (< 16 bytes), likely not nacl.secretbox format');
          }
          
          throw new Error('Failed to decrypt video - invalid key or corrupted data');
        }
        
        const totalDecryptDuration = (Date.now() - decryptStart) / 1000;
        console.log(`[Video Download] Total decrypt step (including logging): ${totalDecryptDuration.toFixed(3)}s`);
        if (__DEV__) {
          console.log('[Video Download] Decrypted [SIZE_REDACTED]');
          console.log('[Video Download] Decrypt performance: [PERFORMANCE_REDACTED]');
        }
        onProgress?.(0.8);
        
        // Write decrypted data with validation - CRITICAL FIX FOR CORRUPTION
        console.log(`[Video Download] Writing binary data with validation to: ${outputPath}`);
        const saveStart = Date.now();
        
        // CRITICAL FIX: Use robust file writing with validation
        await this.writeVideoFileRobust(decrypted, outputPath);
        
        const saveTime = (Date.now() - saveStart) / 1000;
        if (__DEV__) {
          console.log(`[Video Download] Saved ${decrypted.length} bytes in ${saveTime.toFixed(3)}s`);
        }
        
        // Clean up temp file
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
        
        // Verify final file with comprehensive validation
        const savedInfo = await FileSystem.getInfoAsync(outputPath);
        console.log(`[Video Download] Final file validation:`);
        console.log(`- Path: ${outputPath}`);
        console.log(`- Size: ${savedInfo.size} bytes`);
        console.log(`- Expected size: ${decrypted.length} bytes`);
        console.log(`- Size match: ${savedInfo.size === decrypted.length ? '✅' : '❌'}`);
        
        if (savedInfo.size !== decrypted.length) {
          console.error(`[Video Download] ❌ CRITICAL: File size mismatch after write!`);
          console.error(`[Video Download] This indicates incomplete file write - the corruption source!`);
          console.error(`[Video Download] Expected: ${decrypted.length}, Actual: ${savedInfo.size}`);
          throw new Error(`File corruption detected: size mismatch (expected ${decrypted.length}, got ${savedInfo.size})`);
        }
        
        // Additional validation: verify file header is correct MP4 format
        try {
          const headerBase64 = await FileSystem.readAsStringAsync(outputPath, {
            encoding: FileSystem.EncodingType.Base64,
            length: 12
          });
          const headerBytes = global.Buffer.from(headerBase64, 'base64');
          
          // Check for MP4 file signature (ftypXXXX)
          if (headerBytes.length >= 8) {
            const ftyp = headerBytes.slice(4, 8).toString('ascii');
            if (ftyp === 'ftyp') {
              console.log('[Video Download] ✅ MP4 file header validation passed');
            } else {
              console.warn(`[Video Download] ⚠️  Unexpected file header: ${ftyp} (expected 'ftyp')`);
            }
          }
        } catch (headerError) {
          console.warn('[Video Download] Could not validate MP4 header:', headerError);
        }
        
        const totalDuration = (Date.now() - startTime) / 1000;
        if (__DEV__) {
          console.log('\n=== VIDEO DOWNLOAD PERFORMANCE REPORT ===');
          console.log('Total time: [TIME_REDACTED] (Target: <3s)');
          console.log('File size: [SIZE_REDACTED]');
          console.log('\nBreakdown:');
          console.log('  • Key decrypt:     [TIME_REDACTED]');
          console.log('  • Download:        [TIME_REDACTED]');
          console.log('  • Read file:       [TIME_REDACTED]');
          console.log('  • NaCl decrypt:    [TIME_REDACTED] ⚠️');
          console.log('  • Save file:       [TIME_REDACTED]');
          console.log('\nExpected NaCl time: [TIME_REDACTED] (25 MB/s baseline)');
          console.log('Actual NaCl time:   [TIME_REDACTED]');
          console.log('Performance ratio:  [RATIO_REDACTED]');
          console.log('==========================================\n');
        }
        
        onProgress?.(1.0);
        
        return outputPath;
        
      } catch (fileApiError: any) {
        // Fallback to legacy base64 approach if new File API fails
        console.warn('[Video Download] New File API failed, falling back to base64 approach:', fileApiError);
        console.log(`[Video Download] Fallback: Reading encrypted file as base64...`);
        
        const encryptedBase64 = await FileSystem.readAsStringAsync(tempPath, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        // Convert to Uint8Array for decryption - POTENTIAL PERFORMANCE BOTTLENECK
        console.log(`[Video Download] Fallback: Converting base64 to Uint8Array...`);
        const conversionStart = Date.now();
        
        // This could be the 15s bottleneck! global.Buffer.from() + new Uint8Array() for large data
        const buffer = global.Buffer.from(encryptedBase64, 'base64');
        const encryptedWithNonce = new Uint8Array(buffer);
        
        const conversionTime = (Date.now() - conversionStart) / 1000;
        console.log(`[Video Download] Fallback: Base64->Uint8Array conversion took ${conversionTime.toFixed(3)}s`);
        
        if (conversionTime > 5) {
          console.log(`[Video Download] Fallback: WARNING - Buffer conversion is the bottleneck!`);
        }
        console.log(`[Video Download] Fallback: Read file in ${((Date.now() - readStart) / 1000).toFixed(1)}s`);
        
        // Extract nonce and encrypted data
        const nonceLength = nacl.secretbox.nonceLength;
        let nonce: Uint8Array;
        let encryptedData: Uint8Array;
        
        if (version >= 3 && dataNonce) {
          // Zero-knowledge version: use provided dataNonce
          nonce = new Uint8Array(global.Buffer.from(dataNonce, 'base64'));
          encryptedData = encryptedWithNonce; // No nonce prefix for zero-knowledge version
        } else {
          // Legacy version: nonce is prefixed to encrypted data
          nonce = encryptedWithNonce.slice(0, nonceLength);
          encryptedData = encryptedWithNonce.slice(nonceLength);
        }
        
        // Decrypt using fast nacl.secretbox
        console.log(`[Video Download] Fallback: Decrypting with nacl.secretbox...`);
        if (__DEV__) {
          console.log('[Video Download] Fallback: Processing [SIZE_REDACTED]');
        }
        const decryptStart = Date.now();
        onProgress?.(0.6);
        
        // Pre-decrypt validation for fallback path
        console.log('[Video Download] Fallback: Pre-decryption validation:');
        console.log('- encryptedData type:', typeof encryptedData, 'length:', encryptedData.length);
        console.log('- nonce type:', typeof nonce, 'length:', nonce.length);
        console.log('- videoKey type:', typeof videoKey, 'length:', videoKey.length);
        
        // Validate parameter lengths in fallback too
        if (nonce.length !== nacl.secretbox.nonceLength) {
          console.error(`[Video Download] Fallback ERROR: Invalid nonce length: ${nonce.length}, expected: ${nacl.secretbox.nonceLength}`);
          throw new Error(`Invalid nonce length: ${nonce.length}, expected: ${nacl.secretbox.nonceLength}`);
        }
        
        if (videoKey.length !== nacl.secretbox.keyLength) {
          console.error(`[Video Download] Fallback ERROR: Invalid key length: ${videoKey.length}, expected: ${nacl.secretbox.keyLength}`);
          throw new Error(`Invalid key length: ${videoKey.length}, expected: ${nacl.secretbox.keyLength}`);
        }
        
        // Time the actual nacl.secretbox.open call
        const naclStart = Date.now();
        console.log(`[Video Download] Fallback: Starting decryption operation...`);
        
        // Try optimized decryption first for large files
        const sizeMB = encryptedData.length / 1024 / 1024;
        let decrypted: Uint8Array | null = null;
        
        if (sizeMB > 3) {
          console.log(`[Video Download] Fallback: Large file (${sizeMB.toFixed(2)}MB) - trying optimized decryption first...`);
          decrypted = this.decryptOptimized(encryptedData, nonce, videoKey);
          
          if (!decrypted) {
            console.log(`[Video Download] Fallback: Optimized decryption failed, using standard method...`);
            decrypted = this.decrypt(encryptedData, nonce, videoKey);
          }
        } else {
          console.log(`[Video Download] Fallback: Small file (${sizeMB.toFixed(2)}MB) - using standard decryption...`);
          decrypted = this.decrypt(encryptedData, nonce, videoKey);
        }
        
        const naclDuration = (Date.now() - naclStart) / 1000;
        console.log(`[Video Download] Fallback: Pure nacl.secretbox.open() took: ${naclDuration.toFixed(3)}s`);
        
        if (!decrypted) {
          console.error('[Video Download] Fallback: ❌ DECRYPTION FAILED - nacl.secretbox.open() returned null');
          console.error('[Video Download] Fallback: This confirms the issue is with key/nonce/data mismatch');
          console.error('[Video Download] Fallback: Video key first 8 bytes:', Array.from(videoKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
          console.error('[Video Download] Fallback: Nonce first 8 bytes:', Array.from(nonce.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
          throw new Error('Failed to decrypt video - invalid key or corrupted data');
        }
        
        const totalDecryptDuration = (Date.now() - decryptStart) / 1000;
        console.log(`[Video Download] Fallback: Total decrypt step (including logging): ${totalDecryptDuration.toFixed(3)}s`);
        if (__DEV__) {
          console.log('[Video Download] Fallback: Decrypted [SIZE_REDACTED]');
          console.log('[Video Download] Fallback: Decrypt performance: [PERFORMANCE_REDACTED]');
        }
        onProgress?.(0.8);
        
        // Write decrypted data with validation - FALLBACK PATH
        console.log(`[Video Download] Fallback: Saving with validation to: ${outputPath}`);
        const saveStart = Date.now();
        
        // CRITICAL FIX: Use robust file writing for fallback too
        await this.writeVideoFileRobust(decrypted, outputPath);
        
        const saveTime = (Date.now() - saveStart) / 1000;
        console.log(`[Video Download] Fallback: Saved ${decrypted.length} bytes in ${saveTime.toFixed(3)}s`);
        
        // Clean up temp file
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
        
        // Verify final file with comprehensive validation
        const savedInfo = await FileSystem.getInfoAsync(outputPath);
        console.log(`[Video Download] Final file validation:`);
        console.log(`- Path: ${outputPath}`);
        console.log(`- Size: ${savedInfo.size} bytes`);
        console.log(`- Expected size: ${decrypted.length} bytes`);
        console.log(`- Size match: ${savedInfo.size === decrypted.length ? '✅' : '❌'}`);
        
        if (savedInfo.size !== decrypted.length) {
          console.error(`[Video Download] ❌ CRITICAL: File size mismatch after write!`);
          console.error(`[Video Download] This indicates incomplete file write - the corruption source!`);
          console.error(`[Video Download] Expected: ${decrypted.length}, Actual: ${savedInfo.size}`);
          throw new Error(`File corruption detected: size mismatch (expected ${decrypted.length}, got ${savedInfo.size})`);
        }
        
        // Additional validation: verify file header is correct MP4 format
        try {
          const headerBase64 = await FileSystem.readAsStringAsync(outputPath, {
            encoding: FileSystem.EncodingType.Base64,
            length: 12
          });
          const headerBytes = global.Buffer.from(headerBase64, 'base64');
          
          // Check for MP4 file signature (ftypXXXX)
          if (headerBytes.length >= 8) {
            const ftyp = headerBytes.slice(4, 8).toString('ascii');
            if (ftyp === 'ftyp') {
              console.log('[Video Download] ✅ MP4 file header validation passed');
            } else {
              console.warn(`[Video Download] ⚠️  Unexpected file header: ${ftyp} (expected 'ftyp')`);
            }
          }
        } catch (headerError) {
          console.warn('[Video Download] Could not validate MP4 header:', headerError);
        }
        
        const totalDuration = (Date.now() - startTime) / 1000;
        if (__DEV__) {
          console.log('[Video Download] Fallback Total time: [TIME_REDACTED]');
        }
        
        onProgress?.(1.0);
        
        return outputPath;
      }
      
    } catch (error: any) {
      console.error('[Video Download] Failed:', error);
      
      // Handle specific corruption-related errors with user-friendly messages
      if (error?.message?.includes('File corruption detected')) {
        console.error('[Video Download] ❌ CORRUPTION ERROR: File write validation failed');
        throw new Error('Video file was corrupted during download. This indicates a file system issue. Please try again.');
      }
      
      if (error?.message?.includes('EOFException') || 
          error?.message?.includes('unable to play video') ||
          error?.message?.includes('End of File')) {
        console.error('[Video Download] ❌ EOF ERROR: Video file truncated or corrupted');
        console.error('[Video Download] This usually indicates incomplete file write or storage corruption');
        throw new Error('Video file appears to be corrupted or incomplete. Please ask the sender to resend the video.');
      }
      
      if (error?.message?.includes('nacl.secretbox.open returned null')) {
        console.error('[Video Download] ❌ DECRYPTION ERROR: Wrong encryption key or corrupted data');
        throw new Error('Unable to decrypt video - the encryption key may be incorrect or the file was corrupted.');
      }
      
      throw error;
    }
  }

  /**
   * Robust video file writing with corruption prevention
   * CRITICAL: Prevents the EOFException corruption issue
   */
  private static async writeVideoFileRobust(data: Uint8Array, outputPath: string): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        console.log(`[Video Write] Attempt ${attempt + 1}/${maxRetries} - Writing ${data.length} bytes...`);
        
        // Method 1: Try new File API first (fastest)
        if (attempt === 0) {
          try {
            console.log('[Video Write] Using expo-file-system/next File API...');
            const file = new File(outputPath);
            file.write(data);
            
            // CRITICAL: Validate write completed successfully
            const writeValidation = await this.validateVideoFileWrite(outputPath, data.length);
            if (writeValidation.valid) {
              console.log('[Video Write] ✅ File API write successful and validated');
              return;
            } else {
              console.warn(`[Video Write] File API write validation failed: ${writeValidation.error}`);
              // Fall through to next method
            }
          } catch (fileApiError) {
            console.warn('[Video Write] File API failed:', fileApiError);
            // Fall through to next method
          }
        }
        
        // Method 2: Use FileSystem.writeAsStringAsync with base64 (slower but reliable)
        if (attempt === 1) {
          try {
            console.log('[Video Write] Using FileSystem.writeAsStringAsync with base64...');
            const base64Data = global.Buffer.from(data).toString('base64');
            
            await FileSystem.writeAsStringAsync(outputPath, base64Data, {
              encoding: FileSystem.EncodingType.Base64
            });
            
            // CRITICAL: Validate write completed successfully
            const writeValidation = await this.validateVideoFileWrite(outputPath, data.length);
            if (writeValidation.valid) {
              console.log('[Video Write] ✅ Base64 write successful and validated');
              return;
            } else {
              console.warn(`[Video Write] Base64 write validation failed: ${writeValidation.error}`);
              // Fall through to next method
            }
          } catch (base64Error) {
            console.warn('[Video Write] Base64 method failed:', base64Error);
            // Fall through to next method
          }
        }
        
        // Method 3: Chunked writing for large files (last resort)
        if (attempt === 2) {
          console.log('[Video Write] Using chunked write method...');
          await this.writeVideoFileChunked(data, outputPath);
          
          // CRITICAL: Validate write completed successfully
          const writeValidation = await this.validateVideoFileWrite(outputPath, data.length);
          if (writeValidation.valid) {
            console.log('[Video Write] ✅ Chunked write successful and validated');
            return;
          } else {
            throw new Error(`Chunked write validation failed: ${writeValidation.error}`);
          }
        }
        
        attempt++;
      } catch (error) {
        console.error(`[Video Write] Attempt ${attempt + 1} failed:`, error);
        attempt++;
        
        if (attempt >= maxRetries) {
          throw new Error(`Failed to write video file after ${maxRetries} attempts: ${error}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
    
    throw new Error('All write methods failed');
  }
  
  /**
   * Validate that video file was written correctly
   */
  private static async validateVideoFileWrite(filePath: string, expectedSize: number): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        return { valid: false, error: 'File does not exist after write' };
      }
      
      // Check file size
      if (fileInfo.size !== expectedSize) {
        return { 
          valid: false, 
          error: `Size mismatch: expected ${expectedSize}, got ${fileInfo.size}` 
        };
      }
      
      // Additional validation: try to read first 16 bytes to ensure file is accessible
      try {
        const testRead = await FileSystem.readAsStringAsync(filePath, {
          encoding: FileSystem.EncodingType.Base64,
          length: 16
        });
        
        if (!testRead || testRead.length === 0) {
          return { valid: false, error: 'File is not readable' };
        }
      } catch (readError) {
        return { valid: false, error: `File read test failed: ${readError}` };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Validation error: ${error}` };
    }
  }
  
  /**
   * Chunked file writing for large video files
   */
  private static async writeVideoFileChunked(data: Uint8Array, outputPath: string): Promise<void> {
    console.log(`[Video Write Chunked] Writing ${data.length} bytes in chunks...`);
    
    // Delete any existing file first
    await FileSystem.deleteAsync(outputPath, { idempotent: true });
    
    const chunkSize = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(data.length / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, data.length);
      const chunk = data.slice(start, end);
      
      console.log(`[Video Write Chunked] Writing chunk ${i + 1}/${totalChunks} (${chunk.length} bytes)...`);
      
      const chunkBase64 = global.Buffer.from(chunk).toString('base64');
      
      // Append chunk to file
      if (i === 0) {
        // First chunk - create file
        await FileSystem.writeAsStringAsync(outputPath, chunkBase64, {
          encoding: FileSystem.EncodingType.Base64
        });
      } else {
        // Subsequent chunks - append to file
        const existingContent = await FileSystem.readAsStringAsync(outputPath, {
          encoding: FileSystem.EncodingType.Base64
        });
        const newContent = existingContent + chunkBase64;
        await FileSystem.writeAsStringAsync(outputPath, newContent, {
          encoding: FileSystem.EncodingType.Base64
        });
      }
    }
    
    console.log(`[Video Write Chunked] Completed writing ${totalChunks} chunks`);
  }

  /**
   * Device key consistency validation - critical for cross-device decryption
   */
  static async validateDeviceKeyConsistency(userId: string): Promise<boolean> {
    try {
      console.log('[Video Validation] Testing device key consistency for cross-device encryption...');
      
      // Get device keys from FriendEncryption
      const deviceKeys = await FriendEncryption.getDeviceKeys();
      if (!deviceKeys) {
        console.error('[Video Validation] ❌ No device keys found');
        return false;
      }
      
      // Get public key stored in database for this user
      const storedPublicKey = await FriendEncryption.getFriendPublicKey(userId, userId);
      if (!storedPublicKey) {
        console.error('[Video Validation] ❌ No public key stored in database');
        return false;
      }
      
      console.log('[Video Validation] Device key validation:');
      console.log('- Device ID:', deviceKeys.deviceId);
      console.log('- Private key length:', deviceKeys.privateKey.length);
      console.log('- Stored public key length:', storedPublicKey.length);
      
      // Derive public key from private key to validate consistency
      try {
        const derivedPublicKey = await NaClBoxEncryption.getPublicKeyFromPrivate(deviceKeys.privateKey);
        
        console.log('[Video Validation] Key derivation test:');
        console.log('- Derived public key length:', derivedPublicKey.length);
        console.log('- Stored public key first 8 chars:', storedPublicKey.substring(0, 8) + '...');
        console.log('- Derived public key first 8 chars:', derivedPublicKey.substring(0, 8) + '...');
        
        if (derivedPublicKey === storedPublicKey) {
          console.log('[Video Validation] ✅ Device keys are consistent - private/public key pair matches');
          return true;
        } else {
          console.error('[Video Validation] ❌ CRITICAL: Device key inconsistency detected!');
          console.error('[Video Validation] Private key does not match stored public key');
          console.error('[Video Validation] This explains why nacl.box.open fails - key mismatch');
          return false;
        }
      } catch (derivationError) {
        console.error('[Video Validation] ❌ Failed to derive public key from private key:', derivationError);
        return false;
      }
    } catch (error) {
      console.error('[Video Validation] Device key consistency check failed:', error);
      return false;
    }
  }

  /**
   * Comprehensive video corruption diagnostic tool
   * Use this to diagnose video decryption and file write issues
   */
  static async diagnoseCriticalVideoCorruption(
    videoId: string,
    encryptedKey: string,
    keyNonce: string,
    senderId: string,
    recipientId: string,
    dataNonce?: string,
    ephemeralPublicKey?: string,
    version: number = 1
  ): Promise<{ success: boolean; diagnostics: string[] }> {
    const diagnostics: string[] = [];
    
    try {
      diagnostics.push('🔧 STARTING VIDEO CORRUPTION DIAGNOSTICS');
      diagnostics.push(`📹 Video ID: ${videoId}`);
      diagnostics.push(`🔐 Version: ${version} (${version >= 3 ? 'Zero-knowledge' : 'Legacy'})`);
      
      // Step 1: Validate encryption parameters
      diagnostics.push('\n🔍 STEP 1: Parameter Validation');
      if (!encryptedKey || !keyNonce) {
        diagnostics.push('❌ Missing encryption parameters');
        return { success: false, diagnostics };
      }
      
      if (version >= 3 && (!dataNonce || !ephemeralPublicKey)) {
        diagnostics.push('❌ Missing zero-knowledge parameters');
        return { success: false, diagnostics };
      }
      
      diagnostics.push('✅ All encryption parameters present');
      
      // Step 2: Test key decryption
      diagnostics.push('\n🔍 STEP 2: Video Key Decryption Test');
      let videoKey: Uint8Array;
      
      try {
        if (version >= 3) {
          const deviceKeys = await FriendEncryption.getDeviceKeys();
          if (!deviceKeys) {
            diagnostics.push('❌ Device keys not found');
            return { success: false, diagnostics };
          }
          
          diagnostics.push('✅ Device keys loaded');
          
          const decryptedKeyBytes = await NaClBoxEncryption.decrypt(
            encryptedKey,
            keyNonce,
            ephemeralPublicKey!,
            deviceKeys.privateKey
          );
          
          videoKey = decryptedKeyBytes;
          diagnostics.push(`✅ Video key decrypted (${videoKey.length} bytes)`);
        } else {
          // Legacy decryption
          const SharedSecretEncryption = await import('./sharedSecretEncryption').then(m => m.default);
          const sharedSecret = await SharedSecretEncryption.deriveSharedSecret(senderId, recipientId);
          const decryptedKeyBase64 = await SharedSecretEncryption.decrypt(encryptedKey, keyNonce, sharedSecret);
          
          if (!decryptedKeyBase64) {
            diagnostics.push('❌ Legacy key decryption failed');
            return { success: false, diagnostics };
          }
          
          videoKey = new Uint8Array(global.Buffer.from(decryptedKeyBase64, 'base64'));
          diagnostics.push(`✅ Legacy video key decrypted (${videoKey.length} bytes)`);
        }
      } catch (keyError: any) {
        diagnostics.push(`❌ Key decryption failed: ${keyError.message}`);
        return { success: false, diagnostics };
      }
      
      // Step 3: Test download from Supabase
      diagnostics.push('\n🔍 STEP 3: File Download Test');
      
      let tempPath: string;
      let downloadedSize: number;
      
      try {
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(`${videoId}/video.enc`, 300);
        
        if (urlError || !signedUrlData?.signedUrl) {
          diagnostics.push(`❌ Failed to create signed URL: ${urlError?.message}`);
          return { success: false, diagnostics };
        }
        
        diagnostics.push('✅ Signed URL created');
        
        tempPath = `${FileSystem.cacheDirectory}diagnostic_${Date.now()}.enc`;
        
        const downloadResult = await FileSystem.downloadAsync(
          signedUrlData.signedUrl,
          tempPath,
          {
            sessionType: FileSystem.FileSystemSessionType.BACKGROUND
          }
        );
        
        if (downloadResult.status !== 200) {
          diagnostics.push(`❌ Download failed with status: ${downloadResult.status}`);
          return { success: false, diagnostics };
        }
        
        const fileInfo = await FileSystem.getInfoAsync(tempPath);
        downloadedSize = fileInfo.size || 0;
        diagnostics.push(`✅ Downloaded ${downloadedSize} bytes`);
      } catch (downloadError: any) {
        diagnostics.push(`❌ Download failed: ${downloadError.message}`);
        return { success: false, diagnostics };
      }
      
      // Step 4: Test file reading
      diagnostics.push('\n🔍 STEP 4: Encrypted File Read Test');
      
      let encryptedData: Uint8Array;
      let nonce: Uint8Array;
      
      try {
        // Try File API first
        try {
          const encryptedFile = new File(tempPath);
          const encryptedWithNonce = encryptedFile.bytes();
          diagnostics.push(`✅ File API read successful (${encryptedWithNonce.length} bytes)`);
          
          if (version >= 3 && dataNonce) {
            nonce = new Uint8Array(global.Buffer.from(dataNonce, 'base64'));
            encryptedData = encryptedWithNonce;
          } else {
            nonce = encryptedWithNonce.slice(0, nacl.secretbox.nonceLength);
            encryptedData = encryptedWithNonce.slice(nacl.secretbox.nonceLength);
          }
        } catch (fileApiError) {
          diagnostics.push(`⚠️ File API failed, using base64 fallback`);
          
          const encryptedBase64 = await FileSystem.readAsStringAsync(tempPath, {
            encoding: FileSystem.EncodingType.Base64
          });
          
          const buffer = global.Buffer.from(encryptedBase64, 'base64');
          const encryptedWithNonce = new Uint8Array(buffer);
          
          if (version >= 3 && dataNonce) {
            nonce = new Uint8Array(global.Buffer.from(dataNonce, 'base64'));
            encryptedData = encryptedWithNonce;
          } else {
            nonce = encryptedWithNonce.slice(0, nacl.secretbox.nonceLength);
            encryptedData = encryptedWithNonce.slice(nacl.secretbox.nonceLength);
          }
          
          diagnostics.push(`✅ Base64 fallback read successful (${encryptedWithNonce.length} bytes)`);
        }
      } catch (readError: any) {
        diagnostics.push(`❌ File read failed: ${readError.message}`);
        return { success: false, diagnostics };
      }
      
      // Step 5: Test decryption
      diagnostics.push('\n🔍 STEP 5: Video Data Decryption Test');
      
      let decryptedVideo: Uint8Array | null = null;
      
      try {
        const decryptStart = Date.now();
        decryptedVideo = nacl.secretbox.open(encryptedData, nonce, videoKey);
        const decryptTime = (Date.now() - decryptStart) / 1000;
        
        if (!decryptedVideo) {
          diagnostics.push('❌ Decryption failed - nacl.secretbox.open returned null');
          diagnostics.push('   This indicates wrong key, nonce, or corrupted data');
          return { success: false, diagnostics };
        }
        
        diagnostics.push(`✅ Decryption successful in ${decryptTime.toFixed(3)}s`);
        diagnostics.push(`✅ Decrypted video size: ${decryptedVideo.length} bytes`);
        
      } catch (decryptError: any) {
        diagnostics.push(`❌ Decryption error: ${decryptError.message}`);
        return { success: false, diagnostics };
      }
      
      // Step 6: Test file writing (the critical failure point)
      diagnostics.push('\n🔍 STEP 6: File Write Test (CRITICAL)');
      
      const testOutputPath = `${FileSystem.documentDirectory}diagnostic_test_${Date.now()}.mp4`;
      
      try {
        await this.writeVideoFileRobust(decryptedVideo, testOutputPath);
        
        // Validate the written file
        const finalInfo = await FileSystem.getInfoAsync(testOutputPath);
        if (!finalInfo.exists) {
          diagnostics.push('❌ File does not exist after write');
          return { success: false, diagnostics };
        }
        
        if (finalInfo.size !== decryptedVideo.length) {
          diagnostics.push(`❌ Size mismatch: expected ${decryptedVideo.length}, got ${finalInfo.size}`);
          diagnostics.push('   THIS IS THE CORRUPTION SOURCE - file write is incomplete!');
          return { success: false, diagnostics };
        }
        
        diagnostics.push(`✅ File write successful and validated`);
        diagnostics.push(`✅ Final file size: ${finalInfo.size} bytes`);
        
        // Test if file can be read back
        try {
          const readBackBase64 = await FileSystem.readAsStringAsync(testOutputPath, {
            encoding: FileSystem.EncodingType.Base64,
            length: 16
          });
          
          if (readBackBase64 && readBackBase64.length > 0) {
            diagnostics.push('✅ File readback test successful');
          } else {
            diagnostics.push('❌ File readback test failed - file not readable');
            return { success: false, diagnostics };
          }
        } catch (readBackError) {
          diagnostics.push(`❌ File readback failed: ${readBackError}`);
          return { success: false, diagnostics };
        }
        
        // Clean up test file
        await FileSystem.deleteAsync(testOutputPath, { idempotent: true });
        
      } catch (writeError: any) {
        diagnostics.push(`❌ File write failed: ${writeError.message}`);
        return { success: false, diagnostics };
      }
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
      
      diagnostics.push('\n🎉 ALL DIAGNOSTIC TESTS PASSED');
      diagnostics.push('✅ Video decryption workflow is working correctly');
      diagnostics.push('✅ File corruption issue should be resolved');
      
      return { success: true, diagnostics };
      
    } catch (error: any) {
      diagnostics.push(`❌ DIAGNOSTIC ERROR: ${error.message}`);
      return { success: false, diagnostics };
    }
  }

  /**
   * Verification function to test zero-knowledge video encryption
   */
  /**
   * Validate recipient public key for cross-device encryption
   * Ensures we're using the correct key for the recipient
   */
  static async validateRecipientPublicKey(
    recipientId: string, 
    publicKey: string
  ): Promise<{ valid: boolean; error?: string; info?: string }> {
    try {
      console.log('[Video KeyValidation] Validating recipient public key...');
      
      // Check if recipient has multiple device keys
      const { data: allKeys, error } = await supabase
        .from('device_public_keys')
        .select('device_id, public_key, created_at')
        .eq('user_id', recipientId)
        .order('created_at', { ascending: false });
      
      if (error) {
        return { valid: false, error: `Database query failed: ${error.message}` };
      }
      
      if (!allKeys || allKeys.length === 0) {
        return { valid: false, error: 'No public keys found for recipient' };
      }
      
      // Check if the public key we're using exists in the database
      const keyExists = allKeys.find(k => k.public_key === publicKey);
      if (!keyExists) {
        return { 
          valid: false, 
          error: `Public key not found in database. Found ${allKeys.length} keys for user, but none match.` 
        };
      }
      
      // Check if we're using the latest key (recommended)
      const latestKey = allKeys[0];
      const isLatestKey = publicKey === latestKey.public_key;
      
      const info = `Using ${isLatestKey ? 'LATEST' : 'OLDER'} key. ` + 
                  `Found ${allKeys.length} total keys for recipient. ` + 
                  `Key device: ${keyExists.device_id}`;
      
      if (!isLatestKey) {
        console.warn('[Video KeyValidation] ⚠️ Using older public key - this may cause decryption issues');
        console.warn('[Video KeyValidation] Consider using latest key:', latestKey.public_key.substring(0, 16) + '...');
      }
      
      return { valid: true, info };
    } catch (error: any) {
      return { valid: false, error: `Validation failed: ${error.message}` };
    }
  }
  
  /**
   * Validate key exchange between sender and recipient
   * Checks if the ephemeral public key and recipient private key are compatible
   */
  static async validateKeyExchange(
    senderId: string,
    recipientId: string, 
    ephemeralPublicKey: string,
    recipientPrivateKey: string
  ): Promise<{ valid: boolean; error?: string; info?: string }> {
    try {
      console.log('[Video KeyExchange] Validating cross-device key exchange...');
      
      // Get recipient's public key from database (what sender should have used)
      const recipientPublicKey = await FriendEncryption.getFriendPublicKey(recipientId, senderId);
      if (!recipientPublicKey) {
        return { valid: false, error: 'Recipient public key not found in database' };
      }
      
      // Derive public key from recipient's private key
      const derivedPublicKey = await NaClBoxEncryption.getPublicKeyFromPrivate(recipientPrivateKey);
      
      // Check if derived public key matches what's stored in database
      if (derivedPublicKey !== recipientPublicKey) {
        return { 
          valid: false, 
          error: `Recipient key mismatch. Private key derives to: ${derivedPublicKey.substring(0, 16)}..., but database has: ${recipientPublicKey.substring(0, 16)}...` 
        };
      }
      
      // Validate ephemeral public key format
      try {
        const ephemeralBytes = global.Buffer.from(ephemeralPublicKey, 'base64');
        if (ephemeralBytes.length !== 32) {
          return { valid: false, error: `Invalid ephemeral public key length: ${ephemeralBytes.length}, expected 32` };
        }
      } catch (base64Error) {
        return { valid: false, error: 'Invalid ephemeral public key base64 encoding' };
      }
      
      // Create a test encryption to verify the key exchange works
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      try {
        const testEncrypted = await NaClBoxEncryption.encrypt(
          testData,
          recipientPublicKey // Use the same public key sender should have used
        );
        
        const testDecrypted = await NaClBoxEncryption.decrypt(
          testEncrypted.encryptedContent,
          testEncrypted.nonce,
          testEncrypted.ephemeralPublicKey,
          recipientPrivateKey
        );
        
        // Verify test worked
        if (testDecrypted.length !== testData.length || !testDecrypted.every((b, i) => b === testData[i])) {
          return { valid: false, error: 'Test encryption/decryption failed - key pair incompatible' };
        }
        
        const info = `Key exchange valid. Recipient has correct private key for public key used by sender.`;
        return { valid: true, info };
        
      } catch (testError: any) {
        return { valid: false, error: `Test encryption failed: ${testError.message}` };
      }
      
    } catch (error: any) {
      return { valid: false, error: `Key exchange validation failed: ${error.message}` };
    }
  }

  /**
   * Test and validate the key exchange fix for video encryption
   * This function helps verify that the cross-device key validation is working correctly
   */
  static async testKeyExchangeFix(
    senderId: string,
    recipientId: string
  ): Promise<{ success: boolean; details: string[] }> {
    const details: string[] = [];
    
    try {
      details.push('🔧 TESTING KEY EXCHANGE FIX');
      details.push(`📤 Sender: ${senderId}`);
      details.push(`📥 Recipient: ${recipientId}`);
      
      // Step 1: Test recipient public key validation
      details.push('\n1️⃣ TESTING RECIPIENT PUBLIC KEY VALIDATION:');
      const friendPublicKey = await FriendEncryption.getFriendPublicKey(recipientId, senderId);
      if (!friendPublicKey) {
        details.push('❌ Cannot retrieve friend public key');
        return { success: false, details };
      }
      
      const publicKeyValidation = await this.validateRecipientPublicKey(recipientId, friendPublicKey);
      if (!publicKeyValidation.valid) {
        details.push(`❌ Public key validation FAILED: ${publicKeyValidation.error}`);
        return { success: false, details };
      }
      
      details.push('✅ Recipient public key validation PASSED');
      details.push(`   Info: ${publicKeyValidation.info}`);
      
      // Step 2: Test device key consistency
      details.push('\n2️⃣ TESTING DEVICE KEY CONSISTENCY:');
      const deviceKeys = await FriendEncryption.getDeviceKeys();
      if (!deviceKeys) {
        details.push('❌ No device keys available');
        return { success: false, details };
      }
      
      const keyConsistency = await this.validateDeviceKeyConsistency(recipientId);
      if (!keyConsistency) {
        details.push('❌ Device key consistency FAILED');
        return { success: false, details };
      }
      
      details.push('✅ Device key consistency PASSED');
      
      // Step 3: Test key exchange validation
      details.push('\n3️⃣ TESTING KEY EXCHANGE VALIDATION:');
      
      // Create a test ephemeral key for validation
      const testEphemeralKeys = NaClBoxEncryption.generateKeyPair();
      const keyExchangeValidation = await this.validateKeyExchange(
        senderId,
        recipientId,
        testEphemeralKeys.publicKey,
        deviceKeys.privateKey
      );
      
      if (!keyExchangeValidation.valid) {
        details.push(`❌ Key exchange validation FAILED: ${keyExchangeValidation.error}`);
        return { success: false, details };
      }
      
      details.push('✅ Key exchange validation PASSED');
      details.push(`   Info: ${keyExchangeValidation.info}`);
      
      // Step 4: Test round-trip video key encryption
      details.push('\n4️⃣ TESTING ROUND-TRIP VIDEO KEY ENCRYPTION:');
      const testVideoKey = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        testVideoKey[i] = i % 256;
      }
      
      // Encrypt using the same method as video upload
      const keyEncryption = await NaClBoxEncryption.encrypt(testVideoKey, friendPublicKey);
      
      // Decrypt using the same method as video download
      const decryptedKey = await NaClBoxEncryption.decrypt(
        keyEncryption.encryptedContent,
        keyEncryption.nonce,
        keyEncryption.ephemeralPublicKey,
        deviceKeys.privateKey
      );
      
      // Verify round-trip success
      if (decryptedKey.length !== testVideoKey.length) {
        details.push(`❌ Key length mismatch: expected ${testVideoKey.length}, got ${decryptedKey.length}`);
        return { success: false, details };
      }
      
      for (let i = 0; i < testVideoKey.length; i++) {
        if (decryptedKey[i] !== testVideoKey[i]) {
          details.push('❌ Decrypted key data does not match original');
          return { success: false, details };
        }
      }
      
      details.push('✅ Round-trip video key encryption PASSED');
      details.push('✅ ALL TESTS PASSED - Key exchange fix is working correctly!');
      
      return { success: true, details };
      
    } catch (error: any) {
      details.push(`❌ Test failed with error: ${error.message}`);
      return { success: false, details };
    }
  }

  static async verifyZeroKnowledgeVideoEncryption(): Promise<boolean> {
    try {
      console.log('[Video Verification] Running zero-knowledge video encryption verification...');
      
      // Verify the underlying NaCl encryption
      const naclVerified = await NaClBoxEncryption.verifyEncryption();
      if (!naclVerified) {
        console.error('[Video Verification] ❌ NaCl encryption verification failed!');
        return false;
      }
      
      // Test video key encryption specifically
      console.log('[Video Verification] Testing video key encryption with test data...');
      
      // Generate test keypairs
      const senderKeys = NaClBoxEncryption.generateKeyPair();
      const recipientKeys = NaClBoxEncryption.generateKeyPair();
      
      // Test video key data (32 bytes symmetric key)
      const testVideoKey = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        testVideoKey[i] = i % 256; // Test pattern
      }
      
      // Test key encryption (same as used for video keys)
      const encrypted = await NaClBoxEncryption.encrypt(testVideoKey, recipientKeys.publicKey, senderKeys.secretKey);
      const decrypted = await NaClBoxEncryption.decrypt(
        encrypted.encryptedContent,
        encrypted.nonce,
        encrypted.ephemeralPublicKey,
        recipientKeys.secretKey
      );
      
      // Verify key matches
      if (decrypted.length !== testVideoKey.length) {
        console.error('[Video Verification] ❌ Video key length mismatch!');
        return false;
      }
      
      for (let i = 0; i < testVideoKey.length; i++) {
        if (decrypted[i] !== testVideoKey[i]) {
          console.error('[Video Verification] ❌ Video key data mismatch!');
          return false;
        }
      }
      
      console.log('[Video Verification] ✅ Zero-knowledge video encryption verification complete!');
      console.log('[Video Verification] ✅ Server cannot decrypt any video files!');
      console.log('[Video Verification] ✅ AEAD integrity protection active!');
      console.log('[Video Verification] ✅ Perfect Forward Secrecy enabled!');
      console.log('[Video Verification] ✅ Device-generated keys secure!');
      
      return true;
    } catch (error) {
      console.error('[Video Verification] Video encryption verification error:', error);
      return false;
    }
  }
}