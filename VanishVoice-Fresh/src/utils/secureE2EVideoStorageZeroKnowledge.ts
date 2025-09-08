/**
 * Zero-Knowledge E2E Video Storage
 * 
 * This module provides true zero-knowledge end-to-end encrypted storage for video messages.
 * The server CANNOT decrypt video files because it never has access to private keys.
 * 
 * SECURITY MODEL:
 * - Uses nacl.box for hybrid encryption (random key + asymmetric key encryption)
 * - Private keys stored only in secure hardware on device
 * - Server can store encrypted data but never decrypt it
 * - Perfect security: even if server is compromised, videos remain encrypted
 */

import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system/next';
import { supabase } from '../services/supabase';
import { Platform } from 'react-native';
import { compressVideo, cleanupCompressedVideo, type CompressionProgress } from '../services/videoCompression';
import NaClBoxEncryption from './NaClBoxEncryption';
import SecureDeviceKeys from './SecureDeviceKeys';
import FriendEncryption from './friendEncryption';

// React Native performance debugging flags
const ENABLE_PERFORMANCE_LOGGING = true;

export interface ZKVideoUploadResult {
  videoId: string;
  encryptedKey: string;
  keyNonce: string;
  dataNonce: string;
  ephemeralPublicKey: string;
}

export class SecureE2EVideoStorageZeroKnowledge {
  /**
   * Upload video with compression and zero-knowledge encryption
   * Server CANNOT decrypt this video because it doesn't have private keys
   */
  static async encryptAndUploadVideo(
    videoUri: string,
    senderId: string,
    recipientId: string,
    onProgress?: (progress: number) => void,
    onCompressionProgress?: (progress: CompressionProgress) => void
  ): Promise<ZKVideoUploadResult> {
    const startTime = Date.now();
    let compressedVideoUri: string | null = null;
    
    try {
      console.log('[ZK Video Upload] Starting zero-knowledge encrypted video upload...');
      
      // Get original file info
      const originalFileInfo = await FileSystem.getInfoAsync(videoUri);
      const originalSizeMB = (originalFileInfo.size || 0) / 1024 / 1024;
      console.log(`[ZK Video Upload] Original size: ${originalSizeMB.toFixed(2)}MB`);
      
      // Compress video first (takes up to 40% of progress)
      onProgress?.(0.05);
      console.log('[ZK Video Upload] Starting compression...');
      
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
      console.log(`[ZK Video Upload] Compressed to: ${compressedSizeMB.toFixed(2)}MB (${compressionResult.compressionRatio.toFixed(1)}% reduction)`);
      
      // Generate video ID
      const videoId = `video_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Get recipient's public key for zero-knowledge encryption
      const recipientPublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(recipientId);
      if (!recipientPublicKey) {
        throw new Error('Recipient public key not found - they need to open the app first');
      }
      
      // Read compressed file as base64 for encryption
      onProgress?.(0.45);
      console.log('[ZK Video Upload] Reading compressed file...');
      let videoBase64: string;
      
      try {
        // Use new File API for direct reading
        const compressedFile = new File(compressedVideoUri);
        const videoData = compressedFile.bytes();
        videoBase64 = Buffer.from(videoData).toString('base64');
        console.log(`[ZK Video Upload] Read ${videoData.length} bytes directly as binary`);
      } catch (fileApiError: any) {
        // Fallback to traditional FileSystem API
        console.warn('[ZK Video Upload] New File API failed, using FileSystem fallback:', fileApiError);
        videoBase64 = await FileSystem.readAsStringAsync(compressedVideoUri, {
          encoding: FileSystem.EncodingType.Base64
        });
        console.log(`[ZK Video Upload] Read video via FileSystem API`);
      }
      
      // Encrypt using zero-knowledge encryption (nacl.box hybrid)
      onProgress?.(0.55);
      console.log('[ZK Video Upload] Encrypting with zero-knowledge encryption...');
      const encryptionStart = Date.now();
      
      const encryptionResult = await NaClBoxEncryption.encryptBinary(
        videoBase64,
        recipientPublicKey
      );
      
      const encryptionTime = (Date.now() - encryptionStart) / 1000;
      console.log(`[ZK Video Upload] Encrypted in ${encryptionTime.toFixed(1)}s`);
      console.log('[ZK Video Upload] Server CANNOT decrypt this video!');
      
      // Upload encrypted data
      onProgress?.(0.75);
      console.log('[ZK Video Upload] Uploading encrypted video...');
      
      const encryptedBytes = Buffer.from(encryptionResult.encryptedData, 'base64');
      const { error } = await supabase.storage
        .from('videos')
        .upload(`${videoId}/video.enc`, encryptedBytes, {
          contentType: 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      
      // Cleanup compressed video
      if (compressedVideoUri) {
        await cleanupCompressedVideo(compressedVideoUri);
      }
      
      const totalDuration = (Date.now() - startTime) / 1000;
      console.log(`[ZK Video Upload] Complete in ${totalDuration.toFixed(1)}s`);
      console.log(`[ZK Video Upload] Original: ${originalSizeMB.toFixed(2)}MB → Uploaded: ${compressedSizeMB.toFixed(2)}MB`);
      onProgress?.(1.0);
      
      return {
        videoId,
        encryptedKey: encryptionResult.encryptedKey,
        keyNonce: encryptionResult.keyNonce,
        dataNonce: encryptionResult.dataNonce,
        ephemeralPublicKey: encryptionResult.ephemeralPublicKey
      };
      
    } catch (error) {
      // Cleanup on error
      if (compressedVideoUri) {
        await cleanupCompressedVideo(compressedVideoUri).catch(console.error);
      }
      console.error('[ZK Video Upload] Failed:', error);
      throw error;
    }
  }

  /**
   * Download and decrypt zero-knowledge encrypted video
   * Only this device can decrypt because it has the private key
   */
  static async downloadAndDecryptVideo(
    videoId: string,
    encryptedKey: string,
    keyNonce: string,
    dataNonce: string,
    ephemeralPublicKey: string,
    myUserId: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      console.log(`[ZK Video Download] Starting zero-knowledge video download for videoId: ${videoId}`);
      onProgress?.(0.1);
      
      // Get device keys for decryption
      const deviceKeys = await FriendEncryption.getDeviceKeys();
      if (!deviceKeys) {
        throw new Error('Device keys not available');
      }
      
      // Download encrypted video
      onProgress?.(0.2);
      console.log(`[ZK Video Download] Downloading encrypted video from Supabase...`);
      const downloadStart = Date.now();
      
      const { data: encryptedData, error } = await supabase.storage
        .from('videos')
        .download(`${videoId}/video.enc`);
      
      if (error) throw error;
      
      const downloadTime = (Date.now() - downloadStart) / 1000;
      console.log(`[ZK Video Download] Downloaded in ${downloadTime.toFixed(1)}s`);
      
      // Convert blob to bytes
      let encryptedBytes: Uint8Array;
      
      if (encryptedData.arrayBuffer) {
        const arrayBuffer = await encryptedData.arrayBuffer();
        encryptedBytes = new Uint8Array(arrayBuffer);
      } else {
        // React Native fallback
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
          reader.readAsArrayBuffer(encryptedData);
        });
        encryptedBytes = new Uint8Array(arrayBuffer);
      }
      
      const encryptedBase64 = Buffer.from(encryptedBytes).toString('base64');
      
      // Decrypt using zero-knowledge decryption
      onProgress?.(0.5);
      console.log(`[ZK Video Download] Decrypting with zero-knowledge decryption...`);
      const decryptionStart = Date.now();
      
      const decryptedData = await NaClBoxEncryption.decryptBinary(
        encryptedBase64,
        encryptedKey,
        keyNonce,
        dataNonce,
        ephemeralPublicKey,
        deviceKeys.privateKey
      );
      
      const decryptionTime = (Date.now() - decryptionStart) / 1000;
      console.log(`[ZK Video Download] Decrypted in ${decryptionTime.toFixed(1)}s`);
      
      // Save decrypted video to local storage
      onProgress?.(0.8);
      const outputPath = `${FileSystem.documentDirectory}video_${Date.now()}.mp4`;
      const decryptedBase64 = Buffer.from(decryptedData).toString('base64');
      
      await FileSystem.writeAsStringAsync(outputPath, decryptedBase64, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // Verify file was written correctly
      const fileInfo = await FileSystem.getInfoAsync(outputPath);
      if (!fileInfo.exists) {
        throw new Error('Failed to save decrypted video');
      }
      
      const totalTime = (Date.now() - startTime) / 1000;
      const fileSizeMB = (fileInfo.size || 0) / 1024 / 1024;
      
      console.log(`[ZK Video Download] Complete in ${totalTime.toFixed(1)}s`);
      console.log(`[ZK Video Download] Saved: ${fileSizeMB.toFixed(2)}MB to ${outputPath}`);
      
      onProgress?.(1.0);
      
      // Return proper file URI for React Native
      if (Platform.OS === 'ios' && !outputPath.startsWith('file://')) {
        return 'file://' + outputPath;
      }
      
      return outputPath;
      
    } catch (error) {
      console.error(`[ZK Video Download] Failed:`, error);
      throw error;
    }
  }

  /**
   * Legacy compatibility function for existing code
   * Converts old SharedSecretEncryption format to zero-knowledge
   */
  static async downloadAndDecryptVideoLegacy(
    videoId: string,
    encryptedKey: string,
    keyNonce: string,
    senderId: string,
    recipientId: string,
    onProgress?: (progress: number) => void,
    videoNonce?: string
  ): Promise<string> {
    console.log('[ZK Video Download] Legacy compatibility mode - this should be migrated to zero-knowledge');
    
    // For legacy videos, we'd need to fall back to the original SharedSecretEncryption
    // But for now, throw an error to force migration
    throw new Error('Legacy video decryption not yet implemented - please re-record video with zero-knowledge encryption');
  }

  /**
   * Verification function to test zero-knowledge encryption
   */
  static async verifyEncryption(): Promise<boolean> {
    try {
      console.log('[ZK Video] Running zero-knowledge video encryption verification...');
      
      // Verify the underlying NaClBoxEncryption
      const verified = await NaClBoxEncryption.verifyEncryption();
      
      if (verified) {
        console.log('[ZK Video] ✅ Zero-knowledge video encryption verified!');
        console.log('[ZK Video] ✅ Server CANNOT decrypt any video files!');
      } else {
        console.error('[ZK Video] ❌ Zero-knowledge video encryption verification FAILED!');
      }
      
      return verified;
    } catch (error) {
      console.error('[ZK Video] Video encryption verification error:', error);
      return false;
    }
  }
}