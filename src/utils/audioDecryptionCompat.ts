import { downloadAndDecryptE2EAudio } from './e2eAudioStorage';
import { downloadAndDecryptSecureE2EAudio } from './secureE2EAudioStorage';
import { downloadAndDecryptNaClAudio } from './nacl/naclAudioStorage';

/**
 * Universal audio decryption compatibility layer
 * Handles all encryption versions (v1, v2, v3/NaCl)
 */

interface DecryptableMessage {
  media_path: string;
  encryption_iv?: string;
  encrypted_key?: string;
  sender_public_key?: string;
  auth_tag?: string;
  encryption_version?: number;
}

interface UserKeys {
  publicKey: string;
  privateKey: string;
  secretKey?: string; // NaCl secret key
}

export const downloadAndDecryptAudioUniversal = async (
  message: DecryptableMessage,
  userKeys: UserKeys
): Promise<string | null> => {
  try {
    const version = message.encryption_version || 1;
    
    console.log(`[AudioDecryption] Decrypting v${version} message`);
    
    // Ensure we have required fields
    if (!message.media_path || !message.encryption_iv || !message.encrypted_key) {
      console.error('[AudioDecryption] Missing required encryption fields');
      return null;
    }
    
    switch (version) {
      case 3: // NaCl encryption
        if (!userKeys.secretKey) {
          console.error('[AudioDecryption] No NaCl secret key available');
          return null;
        }
        
        return await downloadAndDecryptNaClAudio(
          message.media_path,
          message.encryption_iv, // nonce
          message.encrypted_key, // ephemeral public key
          userKeys.secretKey
        );
        
      case 2: // Secure encryption with auth tag
        if (!message.auth_tag) {
          console.error('[AudioDecryption] No auth tag for v2 message');
          return null;
        }
        
        return await downloadAndDecryptSecureE2EAudio(
          message.media_path,
          message.encrypted_key,
          message.encryption_iv,
          message.auth_tag,
          userKeys
        );
        
      case 1: // Legacy E2E encryption
      default:
        if (!message.sender_public_key) {
          console.error('[AudioDecryption] No sender public key for v1 message');
          return null;
        }
        
        return await downloadAndDecryptE2EAudio(
          message.media_path,
          message.encrypted_key,
          message.encryption_iv,
          message.sender_public_key,
          userKeys
        );
    }
  } catch (error) {
    console.error('[AudioDecryption] Decryption failed:', error);
    
    // Try fallback decryption methods
    if (message.encryption_version === 3 && userKeys.privateKey) {
      console.log('[AudioDecryption] Trying v2 decryption as fallback');
      try {
        return await downloadAndDecryptSecureE2EAudio(
          message.media_path,
          message.encrypted_key,
          message.encryption_iv,
          message.auth_tag || '',
          userKeys
        );
      } catch {
        console.error('[AudioDecryption] v2 fallback failed');
      }
    }
    
    return null;
  }
};

// Check if user can decrypt a message
export const canDecryptMessage = (
  message: DecryptableMessage,
  userKeys: UserKeys
): boolean => {
  const version = message.encryption_version || 1;
  
  switch (version) {
    case 3: // NaCl
      return !!userKeys.secretKey;
    case 2: // Secure
      return !!userKeys.privateKey && !!message.auth_tag;
    case 1: // Legacy
    default:
      return !!userKeys.privateKey && !!message.sender_public_key;
  }
};

// Get user-friendly decryption error message
export const getDecryptionErrorMessage = (
  message: DecryptableMessage,
  userKeys: UserKeys
): string => {
  const version = message.encryption_version || 1;
  
  if (version === 3 && !userKeys.secretKey) {
    return 'This message uses new encryption. Please update your app to decrypt it.';
  }
  
  if (version === 2 && !message.auth_tag) {
    return 'This message is missing authentication data.';
  }
  
  if (!message.encrypted_key || !message.encryption_iv) {
    return 'This message is missing encryption data.';
  }
  
  return 'Unable to decrypt this message. It may be corrupted.';
};