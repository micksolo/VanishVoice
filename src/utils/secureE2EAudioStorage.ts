import { supabase } from '../services/supabase';
import * as FileSystem from 'expo-file-system';
import { encryptMessage, decryptMessage } from './secureE2EEncryption';
import { Audio } from 'expo-av';

/**
 * Secure E2E Audio Storage
 * Handles encrypted audio upload/download with proper cryptography
 */

// Upload encrypted audio using secure encryption
export const uploadSecureE2EAudio = async (
  audioUri: string,
  recipientPublicKey: string,
  senderKeys: { publicKey: string; privateKey: string }
): Promise<{
  storagePath: string;
  encryptedKey: string;
  iv: string;
  authTag: string;
  senderPublicKey: string;
} | null> => {
  try {
    console.log('[SecureE2EAudioStorage] Starting secure upload...');
    
    // Read audio file
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Encrypt using secure encryption
    const encrypted = await encryptMessage(
      audioBase64,
      recipientPublicKey,
      senderKeys.privateKey
    );
    
    // Create file path
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.s2e`;
    const storagePath = `${senderKeys.publicKey.substring(0, 8)}/${fileName}`;
    
    // Convert encrypted data to blob
    const encryptedBlob = await fetch(`data:application/octet-stream;base64,${encrypted.encryptedData}`)
      .then(res => res.blob());
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .upload(storagePath, encryptedBlob, {
        contentType: 'application/octet-stream',
        upsert: false,
      });
    
    if (error) {
      console.error('[SecureE2EAudioStorage] Upload error:', error);
      return null;
    }
    
    console.log('[SecureE2EAudioStorage] Upload successful:', storagePath);
    
    return {
      storagePath,
      encryptedKey: encrypted.encryptedKey,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      senderPublicKey: encrypted.senderPublicKey,
    };
  } catch (error) {
    console.error('[SecureE2EAudioStorage] Error:', error);
    return null;
  }
};

// Download and decrypt audio using secure decryption
export const downloadAndDecryptSecureE2EAudio = async (
  storagePath: string,
  encryptedKey: string,
  iv: string,
  authTag: string,
  recipientKeys: { publicKey: string; privateKey: string }
): Promise<string | null> => {
  try {
    console.log('[SecureE2EAudioStorage] Starting secure download...');
    
    // Download from Supabase
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .download(storagePath);
    
    if (error || !data) {
      console.error('[SecureE2EAudioStorage] Download error:', error);
      return null;
    }
    
    // Convert blob to base64
    const reader = new FileReader();
    const encryptedBase64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(data);
    });
    
    // Decrypt using secure decryption
    const decryptedBase64 = await decryptMessage(
      encryptedBase64,
      encryptedKey,
      iv,
      authTag,
      recipientKeys.privateKey
    );
    
    // Save to local file system
    const localUri = `${FileSystem.cacheDirectory}voice_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(localUri, decryptedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Verify the file
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
      throw new Error('Failed to save decrypted audio');
    }
    
    console.log('[SecureE2EAudioStorage] Decryption successful');
    return localUri;
  } catch (error) {
    console.error('[SecureE2EAudioStorage] Error:', error);
    return null;
  }
};

// Check if a message uses secure encryption
export const isSecureEncrypted = (message: any): boolean => {
  return !!(message.auth_tag && message.encryption_version === 2);
};

// Backward compatibility wrapper
export const downloadAndDecryptAudioCompat = async (
  message: any,
  recipientKeys: { publicKey: string; privateKey: string }
): Promise<string | null> => {
  try {
    // Check if it's secure encryption
    if (isSecureEncrypted(message)) {
      return await downloadAndDecryptSecureE2EAudio(
        message.media_path,
        message.encrypted_key,
        message.encryption_iv,
        message.auth_tag,
        recipientKeys
      );
    }
    
    // Fall back to old encryption
    // Import dynamically to avoid circular dependencies
    const { downloadAndDecryptE2EAudio } = await import('./e2eAudioStorage');
    return await downloadAndDecryptE2EAudio(
      message.media_path,
      message.encrypted_key,
      message.encryption_iv,
      message.sender_public_key,
      recipientKeys
    );
  } catch (error) {
    console.error('[SecureE2EAudioStorage] Compatibility error:', error);
    return null;
  }
};