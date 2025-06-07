import { supabase } from '../../services/supabase';
import * as FileSystem from 'expo-file-system';
import NaClEncryption from './naclEncryption';
import { Buffer } from 'buffer';

/**
 * NaCl-based Audio Storage
 * Production-ready E2E encrypted audio upload/download
 */

interface NaClEncryptedAudio {
  storagePath: string;
  nonce: string;
  ephemeralPublicKey: string;
  senderPublicKey: string;
}

// Upload audio with NaCl encryption
export const uploadNaClEncryptedAudio = async (
  audioUri: string,
  recipientPublicKey: string,
  senderKeys: { publicKey: string; secretKey: string }
): Promise<NaClEncryptedAudio | null> => {
  try {
    console.log('[NaClAudioStorage] Starting encrypted upload...');
    
    // Read audio file as base64
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Convert to Uint8Array for NaCl
    const audioBytes = Buffer.from(audioBase64, 'base64');
    
    // Encrypt using NaCl box
    const encrypted = await NaClEncryption.encrypt(
      audioBytes,
      recipientPublicKey,
      senderKeys.secretKey
    );
    
    // Create storage path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}_${randomId}.nacl`;
    const storagePath = `${senderKeys.publicKey.substring(0, 8)}/${fileName}`;
    
    // Decode base64 to binary array
    const binaryString = atob(encrypted.encrypted);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Upload to Supabase as Uint8Array
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .upload(storagePath, bytes.buffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      });
    
    if (error) {
      console.error('[NaClAudioStorage] Upload error:', error);
      return null;
    }
    
    console.log('[NaClAudioStorage] Upload successful');
    
    return {
      storagePath,
      nonce: encrypted.nonce,
      ephemeralPublicKey: encrypted.ephemeralPublicKey,
      senderPublicKey: senderKeys.publicKey,
    };
  } catch (error) {
    console.error('[NaClAudioStorage] Error:', error);
    return null;
  }
};

// Download and decrypt audio with NaCl
export const downloadAndDecryptNaClAudio = async (
  storagePath: string,
  nonce: string,
  ephemeralPublicKey: string,
  recipientSecretKey: string
): Promise<string | null> => {
  try {
    console.log('[NaClAudioStorage] Starting download and decrypt...');
    console.log('[NaClAudioStorage] Storage path:', storagePath);
    console.log('[NaClAudioStorage] Nonce length:', nonce?.length);
    console.log('[NaClAudioStorage] Ephemeral public key length:', ephemeralPublicKey?.length);
    console.log('[NaClAudioStorage] Recipient secret key length:', recipientSecretKey?.length);
    
    // Download from Supabase
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .download(storagePath);
    
    if (error || !data) {
      console.error('[NaClAudioStorage] Download error:', error);
      return null;
    }
    
    console.log('[NaClAudioStorage] Downloaded blob size:', data.size);
    console.log('[NaClAudioStorage] Downloaded blob type:', data.type);
    
    // Convert blob to base64
    const reader = new FileReader();
    const encryptedBase64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        console.log('[NaClAudioStorage] Converted base64 length:', base64?.length || 0);
        resolve(base64);
      };
      reader.onerror = (err) => {
        console.error('[NaClAudioStorage] FileReader error:', err);
        reject(err);
      };
      reader.readAsDataURL(data);
    });
    
    // Decrypt using NaCl
    const decryptedBytes = await NaClEncryption.decrypt(
      encryptedBase64,
      nonce,
      ephemeralPublicKey,
      recipientSecretKey
    );
    
    // Convert back to base64 for file system
    const decryptedBase64 = Buffer.from(decryptedBytes).toString('base64');
    
    // Save to local file
    const localUri = `${FileSystem.cacheDirectory}voice_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(localUri, decryptedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Verify file exists
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
      throw new Error('Failed to save decrypted audio');
    }
    
    console.log('[NaClAudioStorage] Decryption successful');
    return localUri;
  } catch (error) {
    console.error('[NaClAudioStorage] Decryption error:', error);
    return null;
  }
};

// Sign audio metadata for authenticity
export const signAudioMetadata = async (
  messageId: string,
  storagePath: string,
  timestamp: number,
  senderSecretKey: string
): Promise<string> => {
  const metadata = JSON.stringify({
    messageId,
    storagePath,
    timestamp,
  });
  
  return await NaClEncryption.sign(metadata, senderSecretKey);
};

// Verify audio metadata signature
export const verifyAudioMetadata = async (
  messageId: string,
  storagePath: string,
  timestamp: number,
  signature: string,
  senderPublicKey: string
): Promise<boolean> => {
  const metadata = JSON.stringify({
    messageId,
    storagePath,
    timestamp,
  });
  
  return await NaClEncryption.verify(metadata, signature, senderPublicKey);
};