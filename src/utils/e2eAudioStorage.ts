import { supabase } from '../services/supabase';
import * as FileSystem from 'expo-file-system';
import { encryptForRecipient, decryptFromSender } from './e2eEncryption';
import { Buffer } from 'buffer';

export interface E2EEncryptedUploadResult {
  path: string;
  encryptedKey: string;
  iv: string;
  senderPublicKey: string;
}

/**
 * Upload audio with end-to-end encryption
 * Only the recipient can decrypt this audio
 */
export const uploadE2EEncryptedAudio = async (
  localUri: string, 
  userId: string,
  recipientId: string,
  senderKeys: { publicKey: string; privateKey: string }
): Promise<E2EEncryptedUploadResult | null> => {
  try {
    // Get recipient's public key
    const { data: recipientData } = await supabase
      .from('users')
      .select('public_key')
      .eq('id', recipientId)
      .single();

    if (!recipientData?.public_key) {
      throw new Error('Recipient does not have a public key');
    }

    // Create a unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filename = `${userId}/${timestamp}_${randomId}.e2e`;

    // Read the audio file
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file does not exist');
    }

    // Read file as base64
    const base64Audio = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Encrypt the audio for the recipient
    const { encryptedData, encryptedKey, iv } = await encryptForRecipient(
      base64Audio,
      recipientData.public_key,
      senderKeys.privateKey
    );
    
    // Convert encrypted data to bytes for upload
    const encryptedBytes = Buffer.from(encryptedData, 'base64');

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .upload(filename, encryptedBytes, {
        contentType: 'audio/mpeg', // Use audio mime type for compatibility
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    console.log('E2E encrypted audio uploaded successfully:', filename);
    return {
      path: filename,
      encryptedKey,
      iv,
      senderPublicKey: senderKeys.publicKey
    };
  } catch (error) {
    console.error('Error uploading E2E encrypted audio:', error);
    return null;
  }
};

/**
 * Download and decrypt audio with end-to-end encryption
 * Only works if you have the correct private key
 */
export const downloadAndDecryptE2EAudio = async (
  path: string,
  encryptedKey: string,
  iv: string,
  senderPublicKey: string,
  recipientKeys: { publicKey: string; privateKey: string }
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
    
    // Decrypt the audio using E2E decryption
    const decryptedBase64 = await decryptFromSender(
      encryptedBase64,
      encryptedKey,
      iv,
      recipientKeys.privateKey,
      senderPublicKey
    );
    
    // Save decrypted audio to cache
    const localUri = `${FileSystem.cacheDirectory}voice_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(localUri, decryptedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    return localUri;
  } catch (error) {
    console.error('Error downloading/decrypting E2E audio:', error);
    return null;
  }
};