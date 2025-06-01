import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

// Generate a random encryption key
export const generateEncryptionKey = async (): Promise<string> => {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  return Buffer.from(randomBytes).toString('base64');
};

// Encrypt audio data
export const encryptAudio = async (
  audioData: string | ArrayBuffer,
  key: string
): Promise<{ encryptedData: string; iv: string }> => {
  // Generate initialization vector
  const ivBytes = await Crypto.getRandomBytesAsync(16);
  const iv = Buffer.from(ivBytes).toString('base64');
  
  // Convert audio data to base64 if needed
  let base64Audio: string;
  if (typeof audioData === 'string') {
    base64Audio = audioData;
  } else {
    base64Audio = Buffer.from(audioData).toString('base64');
  }
  
  // For now, we'll use a simple XOR cipher with the key
  // In production, you should use proper AES encryption
  // expo-crypto doesn't provide AES out of the box, so we'll need to implement it
  const encrypted = await simpleEncrypt(base64Audio, key, iv);
  
  return {
    encryptedData: encrypted,
    iv: iv
  };
};

// Decrypt audio data
export const decryptAudio = async (
  encryptedData: string,
  key: string,
  iv: string
): Promise<string> => {
  // Decrypt using the same method
  const decrypted = await simpleDecrypt(encryptedData, key, iv);
  return decrypted;
};

// Simple XOR-based encryption (temporary - should be replaced with proper AES)
async function simpleEncrypt(data: string, key: string, iv: string): Promise<string> {
  // Combine key and IV for better security
  const combinedKey = key + iv;
  const keyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combinedKey,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  
  // Convert to buffers
  const dataBuffer = Buffer.from(data, 'base64');
  const keyBuffer = Buffer.from(keyHash, 'base64');
  
  // XOR encryption
  const encrypted = Buffer.alloc(dataBuffer.length);
  for (let i = 0; i < dataBuffer.length; i++) {
    encrypted[i] = dataBuffer[i] ^ keyBuffer[i % keyBuffer.length];
  }
  
  return encrypted.toString('base64');
}

// Simple XOR-based decryption
async function simpleDecrypt(encryptedData: string, key: string, iv: string): Promise<string> {
  // Same as encryption due to XOR properties
  return simpleEncrypt(encryptedData, key, iv);
}

// Re-export from the fixed version
export { generateKeyPair } from './e2eEncryptionFixed';

// Derive shared secret from recipient's public key
export const deriveSharedSecret = async (
  myPrivateKey: string,
  theirPublicKey: string
): Promise<string> => {
  // Simple key derivation - in production use proper ECDH
  const combined = myPrivateKey + theirPublicKey;
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
};