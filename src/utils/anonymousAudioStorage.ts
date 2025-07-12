import { supabase } from '../services/supabase';
import * as FileSystem from 'expo-file-system';
import AnonymousEncryption from './anonymousEncryption';
import { Buffer } from 'buffer';

class AnonymousAudioStorage {
  // Upload and encrypt audio for anonymous chat
  async uploadAndEncrypt(
    audioUri: string,
    encryption: AnonymousEncryption
  ): Promise<{ storagePath: string; ciphertext: string; nonce: string } | null> {
    try {
      console.log('[AnonymousAudioStorage] Starting encrypted upload...');
      
      // Read audio file
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert to bytes
      const audioBytes = Buffer.from(audioBase64, 'base64');
      
      // Encrypt the audio
      const { ciphertext, nonce } = await encryption.encryptFile(audioBytes);
      
      // Generate unique filename
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.enc`;
      const storagePath = `anonymous/${fileName}`;
      
      // Convert encrypted data to blob
      const encryptedBlob = new Blob([ciphertext], { type: 'audio/encrypted' });
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('voice-messages')
        .upload(storagePath, encryptedBlob, {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      
      if (error) {
        console.error('[AnonymousAudioStorage] Upload error:', error);
        return null;
      }
      
      console.log('[AnonymousAudioStorage] Upload successful:', storagePath);
      
      // Return the storage path to save in message
      return {
        storagePath,
        ciphertext: storagePath, // We store the path, not the encrypted data
        nonce,
      };
    } catch (error) {
      console.error('[AnonymousAudioStorage] Error:', error);
      return null;
    }
  }

  // Download and decrypt audio
  async downloadAndDecrypt(
    storagePath: string,
    encryption: AnonymousEncryption,
    nonce?: string
  ): Promise<string | null> {
    try {
      console.log('[AnonymousAudioStorage] Starting download and decrypt...');
      
      // Download from Supabase
      const { data, error } = await supabase.storage
        .from('voice-messages')
        .download(storagePath);
      
      if (error || !data) {
        console.error('[AnonymousAudioStorage] Download error:', error);
        return null;
      }
      
      // Convert blob to array buffer then to Uint8Array
      const arrayBuffer = await data.arrayBuffer();
      const encryptedData = new Uint8Array(arrayBuffer);
      
      // Use provided nonce or throw error
      if (!nonce) {
        throw new Error('Nonce required for decryption');
      }
      
      // Decrypt the audio
      const decryptedBytes = await encryption.decryptFile(
        encryptedData,
        nonce
      );
      
      // Convert back to base64
      const decryptedBase64 = Buffer.from(decryptedBytes).toString('base64');
      
      // Save to local file system
      const localUri = `${FileSystem.cacheDirectory}anonymous_voice_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(localUri, decryptedBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Verify the file exists
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        throw new Error('Failed to save decrypted audio');
      }
      
      console.log('[AnonymousAudioStorage] Decryption successful');
      return localUri;
    } catch (error) {
      console.error('[AnonymousAudioStorage] Error:', error);
      return null;
    }
  }

  // Clean up old cached files
  async cleanupCache() {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return;
      
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      
      for (const file of files) {
        if (file.startsWith('anonymous_voice_')) {
          await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('[AnonymousAudioStorage] Cleanup error:', error);
    }
  }
}

export default new AnonymousAudioStorage();