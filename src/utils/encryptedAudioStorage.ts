import { supabase } from '../services/supabase';
import * as FileSystem from 'expo-file-system';
import { encryptAudio, decryptAudio, generateEncryptionKey, deriveSharedSecret } from './encryption';
import { encryptForRecipient, decryptFromSender } from './e2eEncryption';
import { Buffer } from 'buffer';

export interface EncryptedUploadResult {
  path: string;
  encryptionKey: string;
  iv: string;
}

export const uploadEncryptedAudio = async (
  localUri: string, 
  userId: string,
  recipientPublicKey?: string
): Promise<EncryptedUploadResult | null> => {
  try {
    // Create a unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filename = `${userId}/${timestamp}_${randomId}.enc`;

    // Read the file
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file does not exist');
    }

    // Read file as base64
    const base64Audio = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Generate encryption key
    const encryptionKey = await generateEncryptionKey();
    
    // Encrypt the audio data
    const { encryptedData, iv } = await encryptAudio(base64Audio, encryptionKey);
    
    // Convert encrypted base64 to bytes for upload
    const encryptedBytes = Buffer.from(encryptedData, 'base64');

    // Upload to Supabase Storage
    // Use audio/mpeg mime type even for encrypted data to satisfy Supabase
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .upload(filename, encryptedBytes, {
        contentType: 'audio/mpeg', // Use audio mime type for compatibility
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    console.log('Encrypted audio uploaded successfully:', filename);
    return {
      path: filename,
      encryptionKey,
      iv
    };
  } catch (error) {
    console.error('Error uploading encrypted audio:', error);
    return null;
  }
};

export const downloadAndDecryptAudio = async (
  path: string,
  encryptionKey: string,
  iv: string
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
    
    // Decrypt the audio
    const decryptedBase64 = await decryptAudio(encryptedBase64, encryptionKey, iv);
    
    // Save decrypted audio to cache
    const localUri = `${FileSystem.cacheDirectory}voice_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(localUri, decryptedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    return localUri;
  } catch (error) {
    console.error('Error downloading/decrypting audio:', error);
    return null;
  }
};

// Store encryption keys securely for a message
export const storeMessageEncryption = async (
  messageId: string,
  senderPrivateKey: string,
  recipientPublicKey: string,
  encryptionKey: string,
  iv: string
) => {
  try {
    // In a real app, you'd want to encrypt the key with the recipient's public key
    // For now, we'll derive a shared secret
    const sharedSecret = await deriveSharedSecret(senderPrivateKey, recipientPublicKey);
    
    // Encrypt the message key with the shared secret
    const { encryptedData: encryptedKey } = await encryptAudio(encryptionKey, sharedSecret);
    
    return {
      encryptedKey,
      iv,
      senderPublicKey: recipientPublicKey // Store for recipient to derive shared secret
    };
  } catch (error) {
    console.error('Error storing message encryption:', error);
    throw error;
  }
};