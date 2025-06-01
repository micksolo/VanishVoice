import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

/**
 * Fixed E2E Encryption Implementation
 * Clear separation between binary data and text data handling
 */

// Generate user keys
export const generateUserKeyPair = async (): Promise<{ publicKey: string; privateKey: string }> => {
  const privateKeyBytes = await Crypto.getRandomBytesAsync(32);
  const privateKey = Buffer.from(privateKeyBytes).toString('base64');
  
  const publicKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    privateKey + '_public_key_derivation',
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  
  return { publicKey, privateKey };
};

// Main encryption function
export const encryptForRecipient = async (
  audioDataBase64: string,
  recipientPublicKey: string,
  senderPrivateKey: string
): Promise<{
  encryptedData: string;
  encryptedKey: string;
  iv: string;
}> => {
  // Generate session key and IV
  const sessionKeyBytes = await Crypto.getRandomBytesAsync(32);
  const sessionKey = Buffer.from(sessionKeyBytes).toString('hex'); // Use hex for clarity
  
  const ivBytes = await Crypto.getRandomBytesAsync(16);
  const iv = Buffer.from(ivBytes).toString('base64');
  
  // Encrypt audio data
  const encryptedData = await encryptBinaryData(audioDataBase64, sessionKey, iv);
  
  // Encrypt session key for recipient
  const sharedSecret = await deriveSharedSecret(senderPrivateKey, recipientPublicKey);
  console.log('[ENCRYPT] Session key:', sessionKey);
  console.log('[ENCRYPT] Shared secret:', sharedSecret.substring(0, 20) + '...');
  const encryptedKey = await encryptTextData(sessionKey, sharedSecret, iv);
  
  return { encryptedData, encryptedKey, iv };
};

// Main decryption function
export const decryptFromSender = async (
  encryptedData: string,
  encryptedKey: string,
  iv: string,
  recipientPrivateKey: string,
  senderPublicKey: string
): Promise<string> => {
  // Derive shared secret
  const sharedSecret = await deriveSharedSecret(recipientPrivateKey, senderPublicKey);
  console.log('[DECRYPT] Shared secret:', sharedSecret.substring(0, 20) + '...');
  
  // Decrypt session key
  const sessionKey = await decryptTextData(encryptedKey, sharedSecret, iv);
  console.log('[DECRYPT] Session key:', sessionKey);
  
  // Decrypt audio data
  const audioDataBase64 = await decryptBinaryData(encryptedData, sessionKey, iv);
  
  return audioDataBase64;
};

// Encrypt binary data (audio as base64)
async function encryptBinaryData(base64Data: string, keyHex: string, ivBase64: string): Promise<string> {
  // Convert inputs
  const dataBuffer = Buffer.from(base64Data, 'base64');
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const ivBuffer = Buffer.from(ivBase64, 'base64');
  
  // Create cipher key by hashing key + iv
  const cipherKeyString = keyHex + ivBase64;
  const cipherKeyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    cipherKeyString,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const cipherKey = Buffer.from(cipherKeyHash, 'hex');
  
  // XOR encryption
  const encrypted = Buffer.alloc(dataBuffer.length);
  for (let i = 0; i < dataBuffer.length; i++) {
    encrypted[i] = dataBuffer[i] ^ cipherKey[i % cipherKey.length];
  }
  
  return encrypted.toString('base64');
}

// Decrypt binary data
async function decryptBinaryData(encryptedBase64: string, keyHex: string, ivBase64: string): Promise<string> {
  // Same as encryption due to XOR
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
  
  // Create cipher key
  const cipherKeyString = keyHex + ivBase64;
  const cipherKeyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    cipherKeyString,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const cipherKey = Buffer.from(cipherKeyHash, 'hex');
  
  // XOR decryption
  const decrypted = Buffer.alloc(encryptedBuffer.length);
  for (let i = 0; i < encryptedBuffer.length; i++) {
    decrypted[i] = encryptedBuffer[i] ^ cipherKey[i % cipherKey.length];
  }
  
  return decrypted.toString('base64');
}

// Encrypt text data (session key)
async function encryptTextData(text: string, keyBase64: string, ivBase64: string): Promise<string> {
  const textBuffer = Buffer.from(text, 'utf8');
  
  // Create cipher key
  const cipherKeyString = keyBase64 + ivBase64;
  const cipherKeyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    cipherKeyString,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const cipherKey = Buffer.from(cipherKeyHash, 'hex');
  
  // XOR encryption
  const encrypted = Buffer.alloc(textBuffer.length);
  for (let i = 0; i < textBuffer.length; i++) {
    encrypted[i] = textBuffer[i] ^ cipherKey[i % cipherKey.length];
  }
  
  return encrypted.toString('base64');
}

// Decrypt text data
async function decryptTextData(encryptedBase64: string, keyBase64: string, ivBase64: string): Promise<string> {
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
  
  // Create cipher key
  const cipherKeyString = keyBase64 + ivBase64;
  const cipherKeyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    cipherKeyString,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const cipherKey = Buffer.from(cipherKeyHash, 'hex');
  
  // XOR decryption
  const decrypted = Buffer.alloc(encryptedBuffer.length);
  for (let i = 0; i < encryptedBuffer.length; i++) {
    decrypted[i] = encryptedBuffer[i] ^ cipherKey[i % cipherKey.length];
  }
  
  return decrypted.toString('utf8');
}

// Derive shared secret - must be commutative
async function deriveSharedSecret(privateKey: string, publicKey: string): Promise<string> {
  // Sort the keys to ensure same result regardless of order
  const keys = [privateKey, publicKey].sort();
  const combined = keys[0] + '|' + keys[1];
  
  const secret = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return secret;
}

export const hasValidKeys = (keys: { publicKey: string; privateKey: string } | null): boolean => {
  return !!(keys && keys.publicKey && keys.privateKey);
};