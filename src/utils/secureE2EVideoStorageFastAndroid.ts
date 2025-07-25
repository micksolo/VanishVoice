import * as FileSystem from 'expo-file-system';
import { supabase } from '../services/supabase';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import SharedSecretEncryption from './sharedSecretEncryption';
import { Platform } from 'react-native';

// Optimized for Android performance
const SAVE_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks for file writing

export class SecureE2EVideoStorageFastAndroid {
  /**
   * Simple XOR encryption
   */
  private static xorEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
    const result = new Uint8Array(data.length);
    const keyLen = key.length;
    
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key[i % keyLen];
    }
    
    return result;
  }

  /**
   * Upload video with minimal overhead
   */
  static async encryptAndUploadVideo(
    videoUri: string,
    senderId: string,
    recipientId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ videoId: string; encryptedKey: string; keyNonce: string }> {
    const startTime = Date.now();
    
    try {
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      const sizeMB = (fileInfo.size || 0) / 1024 / 1024;
      console.log(`[Video Upload] Starting: ${sizeMB.toFixed(2)}MB`);
      
      // Generate keys
      const videoKey = nacl.randomBytes(32);
      const videoId = Buffer.from(nacl.randomBytes(16)).toString('hex');
      
      // Read entire file
      onProgress?.(0.1);
      const videoBase64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64
      });
      const videoData = new Uint8Array(Buffer.from(videoBase64, 'base64'));
      
      // Encrypt
      onProgress?.(0.3);
      const encrypted = this.xorEncrypt(videoData, videoKey);
      
      // Upload
      onProgress?.(0.5);
      const { error } = await supabase.storage
        .from('videos')
        .upload(`${videoId}/video.enc`, Buffer.from(encrypted), {
          contentType: 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      
      onProgress?.(0.9);
      
      // Encrypt video key
      const sharedSecret = await SharedSecretEncryption.deriveSharedSecret(senderId, recipientId);
      const videoKeyBase64 = Buffer.from(videoKey).toString('base64');
      const { encrypted: encryptedKey, nonce: keyNonce } = await SharedSecretEncryption.encrypt(
        videoKeyBase64,
        sharedSecret
      );
      
      console.log(`[Video Upload] Complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      onProgress?.(1.0);
      
      return {
        videoId,
        encryptedKey,
        keyNonce
      };
      
    } catch (error) {
      console.error('[Video Upload] Failed:', error);
      throw error;
    }
  }

  /**
   * Download and decrypt video optimized for Android
   */
  static async downloadAndDecryptVideo(
    videoId: string,
    encryptedKey: string,
    keyNonce: string,
    senderId: string,
    recipientId: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      console.log(`[Video Download] Starting download for videoId: ${videoId}`);
      console.log(`[Video Download] Sender: ${senderId}, Recipient: ${recipientId}`);
      onProgress?.(0.1);
      
      // Decrypt video key
      const sharedSecret = await SharedSecretEncryption.deriveSharedSecret(senderId, recipientId);
      const decryptedKeyBase64 = await SharedSecretEncryption.decrypt(
        encryptedKey,
        keyNonce,
        sharedSecret
      );
      
      if (!decryptedKeyBase64) {
        throw new Error('Failed to decrypt video key');
      }
      
      const videoKey = new Uint8Array(Buffer.from(decryptedKeyBase64, 'base64'));
      
      // Download from Supabase
      onProgress?.(0.2);
      console.log(`[Video Download] Downloading from Supabase...`);
      const downloadStart = Date.now();
      
      let data, error;
      try {
        const result = await supabase.storage
          .from('videos')
          .download(`${videoId}/video.enc`);
        data = result.data;
        error = result.error;
      } catch (downloadError: any) {
        console.error('[Video Download] Supabase download error:', downloadError);
        throw new Error(`Download failed: ${downloadError?.message || 'Unknown error'}`);
      }
      
      if (error || !data) {
        throw new Error(`Download failed: ${error?.message}`);
      }
      
      console.log(`[Video Download] Downloaded ${(data.size / 1024 / 1024).toFixed(2)}MB in ${((Date.now() - downloadStart) / 1000).toFixed(1)}s`);
      onProgress?.(0.5);
      
      // Convert blob to Uint8Array (React Native doesn't support arrayBuffer())
      console.log(`[Video Download] Processing data...`);
      const processStart = Date.now();
      
      let encryptedData: Uint8Array;
      
      // Check if we have arrayBuffer method (web) or need to use FileReader (React Native)
      if (data.arrayBuffer) {
        const arrayBuffer = await data.arrayBuffer();
        encryptedData = new Uint8Array(arrayBuffer);
      } else {
        // React Native path - use FileReader
        const reader = new FileReader();
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(data);
        });
        encryptedData = new Uint8Array(arrayBuffer);
      }
      
      console.log(`[Video Download] Processed data in ${((Date.now() - processStart) / 1000).toFixed(1)}s`);
      
      // Decrypt
      onProgress?.(0.7);
      console.log(`[Video Download] Decrypting...`);
      const decryptStart = Date.now();
      const decrypted = this.xorEncrypt(encryptedData, videoKey);
      console.log(`[Video Download] Decrypted in ${((Date.now() - decryptStart) / 1000).toFixed(1)}s`);
      
      // Save to file - Android optimized approach
      onProgress?.(0.8);
      const outputPath = `${FileSystem.cacheDirectory}video_${Date.now()}.mp4`; // Use cache directory
      
      console.log(`[Video Download] Saving to cache: ${outputPath}`);
      const saveStart = Date.now();
      
      // Write the file in one go - the chunking approach was actually slower!
      const base64Data = Buffer.from(decrypted).toString('base64');
      
      await FileSystem.writeAsStringAsync(outputPath, base64Data, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      console.log(`[Video Download] Saved in ${((Date.now() - saveStart) / 1000).toFixed(1)}s`);
      
      // Verify file
      const savedInfo = await FileSystem.getInfoAsync(outputPath);
      console.log(`[Video Download] Saved file: ${(savedInfo.size! / 1024 / 1024).toFixed(2)}MB at ${outputPath}`);
      
      // Create a copy with proper permissions for Android
      if (Platform.OS === 'android') {
        try {
          // Copy to a more accessible location
          const finalPath = `${FileSystem.documentDirectory}video_${Date.now()}.mp4`;
          await FileSystem.copyAsync({
            from: outputPath,
            to: finalPath
          });
          
          // Delete temp file
          await FileSystem.deleteAsync(outputPath, { idempotent: true });
          
          console.log(`[Video Download] Moved to: ${finalPath}`);
          console.log(`[Video Download] Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
          onProgress?.(1.0);
          
          return finalPath;
        } catch (copyError) {
          console.warn(`[Video Download] Copy failed, using cache location:`, copyError);
        }
      }
      
      console.log(`[Video Download] Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      onProgress?.(1.0);
      
      return outputPath;
      
    } catch (error) {
      console.error('[Video Download] Failed:', error);
      throw error;
    }
  }
}