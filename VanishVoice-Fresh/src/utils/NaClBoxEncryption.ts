/**
 * NaCl Box Encryption Service
 * 
 * This service provides zero-knowledge end-to-end encryption using nacl.box.
 * The server can NEVER decrypt messages because it doesn't have access to private keys.
 * 
 * SECURITY MODEL:
 * - Uses Curve25519 key exchange + XSalsa20 + Poly1305 MAC
 * - Private keys stored only in secure hardware on device
 * - Public keys stored in database for key exchange
 * - Server can route encrypted data but never decrypt it
 * - Perfect Forward Secrecy via ephemeral keys
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import * as Crypto from 'expo-crypto';

export interface EncryptedData {
  encryptedContent: string;
  nonce: string;
  ephemeralPublicKey: string;
}

export interface BoxEncryptionResult {
  encrypted: string;
  nonce: string;
}

class NaClBoxEncryption {
  /**
   * Encrypt data using nacl.box with ephemeral keys for Perfect Forward Secrecy
   * 
   * @param data - Data to encrypt (string or Uint8Array)
   * @param recipientPublicKey - Recipient's public key (base64)
   * @param senderPrivateKey - Sender's private key (base64) - optional for ephemeral
   * @returns Encrypted data with ephemeral public key
   */
  static async encrypt(
    data: string | Uint8Array,
    recipientPublicKey: string,
    senderPrivateKey?: string
  ): Promise<EncryptedData> {
    try {
      console.log('[NaClBoxEncryption] Encrypting data with nacl.box...');
      
      // ENHANCED DEBUGGING: Validate all input parameters
      console.log('[NaClBoxEncryption] Encryption input validation:');
      console.log('- data type:', typeof data);
      console.log('- data length:', typeof data === 'string' ? data.length : data.length);
      console.log('- recipientPublicKey type:', typeof recipientPublicKey, 'length:', recipientPublicKey.length);
      console.log('- senderPrivateKey provided:', !!senderPrivateKey);
      
      // Convert data to bytes
      const dataBytes = typeof data === 'string' 
        ? naclUtil.decodeUTF8(data)
        : data;
      
      console.log('[NaClBoxEncryption] Data converted to bytes:', dataBytes.length);
      
      // Decode and validate recipient's public key first
      let recipientPubKey: Uint8Array;
      try {
        recipientPubKey = naclUtil.decodeBase64(recipientPublicKey);
        console.log('[NaClBoxEncryption] ✅ Decoded recipient public key:', recipientPubKey.length, 'bytes (expected: 32)');
        if (recipientPubKey.length !== 32) {
          throw new Error(`Invalid recipient public key length: ${recipientPubKey.length}, expected 32`);
        }
      } catch (pubKeyError) {
        console.error('[NaClBoxEncryption] ❌ Invalid recipient public key:', pubKeyError);
        throw new Error('Invalid recipient public key: ' + pubKeyError);
      }
      
      // Generate ephemeral keypair for Perfect Forward Secrecy
      console.log('[NaClBoxEncryption] Generating ephemeral keypair...');
      const ephemeralKeys = nacl.box.keyPair();
      console.log('[NaClBoxEncryption] ✅ Ephemeral keypair generated');
      console.log('- Ephemeral public key length:', ephemeralKeys.publicKey.length);
      console.log('- Ephemeral private key length:', ephemeralKeys.secretKey.length);
      
      // Generate random nonce
      const nonce = nacl.randomBytes(24);
      console.log('[NaClBoxEncryption] ✅ Generated nonce:', nonce.length, 'bytes');
      
      // Use ephemeral private key (or provided sender private key)
      const senderPrivKey = senderPrivateKey 
        ? naclUtil.decodeBase64(senderPrivateKey)
        : ephemeralKeys.secretKey;
      
      console.log('[NaClBoxEncryption] Using', senderPrivateKey ? 'provided' : 'ephemeral', 'private key');
      console.log('[NaClBoxEncryption] Private key length:', senderPrivKey.length, 'bytes (expected: 32)');
      
      if (senderPrivKey.length !== 32) {
        throw new Error(`Invalid sender private key length: ${senderPrivKey.length}, expected 32`);
      }
      
      // Debug parameters before encryption
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[NaClBoxEncryption] Pre-encryption parameter validation:');
        console.log('- Data bytes:', dataBytes.length);
        console.log('- Nonce bytes:', nonce.length);
        console.log('- Recipient public key bytes:', recipientPubKey.length);
        console.log('- Sender private key bytes:', senderPrivKey.length);
        
        // Log hex values (first 8 bytes only)
        console.log('[NaClBoxEncryption] Parameter hex values (first 8 bytes):');
        console.log('- Data hex:', Array.from(dataBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('- Nonce hex:', Array.from(nonce.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('- Recipient pub key hex:', Array.from(recipientPubKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('- Sender priv key hex:', Array.from(senderPrivKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      }
      
      // Encrypt using nacl.box
      console.log('[NaClBoxEncryption] Calling nacl.box with validated parameters...');
      const encryptStart = Date.now();
      const encrypted = nacl.box(
        dataBytes,
        nonce,
        recipientPubKey,
        senderPrivKey
      );
      const encryptDuration = Date.now() - encryptStart;
      console.log(`[NaClBoxEncryption] nacl.box completed in ${encryptDuration}ms`);
      
      if (!encrypted) {
        console.error('[NaClBoxEncryption] ❌ CRITICAL: nacl.box returned null');
        console.error('[NaClBoxEncryption] This should not happen with valid parameters');
        throw new Error('Encryption failed - nacl.box returned null');
      }
      
      console.log('[NaClBoxEncryption] ✅ Encryption successful, encrypted length:', encrypted.length);
      
      const result = {
        encryptedContent: naclUtil.encodeBase64(encrypted),
        nonce: naclUtil.encodeBase64(nonce),
        ephemeralPublicKey: senderPrivateKey 
          ? await this.getPublicKeyFromPrivate(senderPrivateKey)
          : naclUtil.encodeBase64(ephemeralKeys.publicKey)
      };
      
      console.log('[NaClBoxEncryption] ✅ Encryption result validation:');
      console.log('- encryptedContent base64 length:', result.encryptedContent.length);
      console.log('- nonce base64 length:', result.nonce.length);
      console.log('- ephemeralPublicKey base64 length:', result.ephemeralPublicKey.length);
      
      console.log('[NaClBoxEncryption] Encryption completed successfully');
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[NaClBoxEncryption] Encrypted content size:', encrypted.length, 'bytes');
      }
      
      return result;
    } catch (error) {
      console.error('[NaClBoxEncryption] Encryption failed:', error);
      throw error;
    }
  }
  
  /**
   * Decrypt data using nacl.box.open
   * 
   * @param encryptedContent - Encrypted data (base64)
   * @param nonce - Nonce used for encryption (base64)
   * @param ephemeralPublicKey - Sender's ephemeral public key (base64)
   * @param recipientPrivateKey - Recipient's private key (base64)
   * @returns Decrypted data as Uint8Array
   */
  static async decrypt(
    encryptedContent: string,
    nonce: string,
    ephemeralPublicKey: string,
    recipientPrivateKey: string
  ): Promise<Uint8Array> {
    try {
      console.log('[NaClBoxEncryption] Decrypting data with nacl.box.open...');
      
      // ENHANCED DEBUGGING: Validate all input parameters first
      console.log('[NaClBoxEncryption] Input parameter validation:');
      console.log('- encryptedContent type:', typeof encryptedContent, 'length:', encryptedContent.length);
      console.log('- nonce type:', typeof nonce, 'length:', nonce.length);
      console.log('- ephemeralPublicKey type:', typeof ephemeralPublicKey, 'length:', ephemeralPublicKey.length);
      console.log('- recipientPrivateKey type:', typeof recipientPrivateKey, 'length:', recipientPrivateKey.length);
      
      // Decode all parameters
      let encryptedBytes: Uint8Array;
      let nonceBytes: Uint8Array;
      let senderPubKey: Uint8Array;
      let recipientPrivKey: Uint8Array;
      
      try {
        encryptedBytes = naclUtil.decodeBase64(encryptedContent);
        console.log('[NaClBoxEncryption] ✅ Decoded encryptedContent:', encryptedBytes.length, 'bytes');
      } catch (e1) {
        console.error('[NaClBoxEncryption] ❌ Failed to decode encryptedContent:', e1);
        throw new Error('Invalid base64 in encryptedContent');
      }
      
      try {
        nonceBytes = naclUtil.decodeBase64(nonce);
        console.log('[NaClBoxEncryption] ✅ Decoded nonce:', nonceBytes.length, 'bytes (expected: 24)');
        if (nonceBytes.length !== 24) {
          throw new Error(`Invalid nonce length: ${nonceBytes.length}, expected 24`);
        }
      } catch (e2) {
        console.error('[NaClBoxEncryption] ❌ Failed to decode nonce:', e2);
        throw new Error('Invalid base64 in nonce or wrong length');
      }
      
      try {
        senderPubKey = naclUtil.decodeBase64(ephemeralPublicKey);
        console.log('[NaClBoxEncryption] ✅ Decoded ephemeralPublicKey:', senderPubKey.length, 'bytes (expected: 32)');
        if (senderPubKey.length !== 32) {
          throw new Error(`Invalid ephemeral public key length: ${senderPubKey.length}, expected 32`);
        }
      } catch (e3) {
        console.error('[NaClBoxEncryption] ❌ Failed to decode ephemeralPublicKey:', e3);
        throw new Error('Invalid base64 in ephemeralPublicKey or wrong length');
      }
      
      try {
        recipientPrivKey = naclUtil.decodeBase64(recipientPrivateKey);
        console.log('[NaClBoxEncryption] ✅ Decoded recipientPrivateKey:', recipientPrivKey.length, 'bytes (expected: 32)');
        if (recipientPrivKey.length !== 32) {
          throw new Error(`Invalid private key length: ${recipientPrivKey.length}, expected 32`);
        }
      } catch (e4) {
        console.error('[NaClBoxEncryption] ❌ Failed to decode recipientPrivateKey:', e4);
        throw new Error('Invalid base64 in recipientPrivateKey or wrong length');
      }
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[NaClBoxEncryption] All parameters decoded successfully');
        console.log('- Encrypted bytes:', encryptedBytes.length);
        console.log('- Nonce bytes:', nonceBytes.length);
        console.log('- Sender public key bytes:', senderPubKey.length);
        console.log('- Recipient private key bytes:', recipientPrivKey.length);
        
        // Log hex values for debugging (first 8 bytes only for security)
        console.log('[NaClBoxEncryption] Parameter hex values (first 8 bytes):');
        console.log('- Encrypted hex:', Array.from(encryptedBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('- Nonce hex:', Array.from(nonceBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('- Sender pub key hex:', Array.from(senderPubKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('- Recipient priv key hex:', Array.from(recipientPrivKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
      }
      
      // Decrypt using nacl.box.open
      console.log('[NaClBoxEncryption] Calling nacl.box.open with validated parameters...');
      const decryptStart = Date.now();
      const decrypted = nacl.box.open(
        encryptedBytes,
        nonceBytes,
        senderPubKey,
        recipientPrivKey
      );
      const decryptDuration = Date.now() - decryptStart;
      console.log(`[NaClBoxEncryption] nacl.box.open completed in ${decryptDuration}ms`);
      
      if (!decrypted) {
        console.error('[NaClBoxEncryption] ❌ CRITICAL: nacl.box.open returned null');
        console.error('[NaClBoxEncryption] This indicates:');
        console.error('  1. Ciphertext authentication failed (tampered data)');
        console.error('  2. Wrong key pair (public/private key mismatch)');
        console.error('  3. Wrong nonce used for decryption');
        console.error('  4. Corrupted encrypted data');
        console.error('[NaClBoxEncryption] Debug parameters used:');
        console.error('  - Encrypted content length:', encryptedBytes.length);
        console.error('  - Nonce length:', nonceBytes.length);
        console.error('  - Ephemeral public key length:', senderPubKey.length);
        console.error('  - Private key length:', recipientPrivKey.length);
        throw new Error('Decryption failed - nacl.box.open returned null');
      }
      
      console.log('[NaClBoxEncryption] ✅ Decryption completed successfully');
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[NaClBoxEncryption] Decrypted output size:', decrypted.length);
      }
      
      return decrypted;
    } catch (error) {
      console.error('[NaClBoxEncryption] Decryption failed:', error);
      throw error;
    }
  }
  
  /**
   * Decrypt and return as UTF-8 string
   */
  static async decryptToString(
    encryptedContent: string,
    nonce: string,
    ephemeralPublicKey: string,
    recipientPrivateKey: string
  ): Promise<string> {
    const decryptedBytes = await this.decrypt(
      encryptedContent,
      nonce,
      ephemeralPublicKey,
      recipientPrivateKey
    );
    
    return naclUtil.encodeUTF8(decryptedBytes);
  }
  
  /**
   * Encrypt binary data (like audio/video files)
   * Uses a hybrid approach: random key + nacl.box for key encryption
   * This is more efficient for large files than direct nacl.box encryption
   * 
   * @param data - Binary data to encrypt (Uint8Array or base64 string)
   * @param recipientPublicKey - Recipient's public key (base64)
   * @returns Encrypted data and encrypted key
   */
  static async encryptBinary(
    data: Uint8Array | string,
    recipientPublicKey: string
  ): Promise<{
    encryptedData: string;
    encryptedKey: string;
    keyNonce: string;
    dataNonce: string;
    ephemeralPublicKey: string;
  }> {
    try {
      console.log('[NaClBoxEncryption] Encrypting binary data...');
      
      // Convert data to bytes if needed
      const dataBytes = typeof data === 'string' 
        ? new Uint8Array(global.Buffer.from(data, 'base64'))
        : data;
      
      // Generate random symmetric key for data encryption
      const dataKey = nacl.randomBytes(32); // 256-bit key
      const dataNonce = nacl.randomBytes(24);
      
      // Encrypt data with symmetric key using XSalsa20
      const encryptedData = (nacl as any).secretbox(dataBytes, dataNonce, dataKey);
      
      if (!encryptedData) {
        throw new Error('Data encryption failed');
      }
      
      // Encrypt the data key using nacl.box
      const keyEncryption = await this.encrypt(
        dataKey,
        recipientPublicKey
      );
      
      console.log('[NaClBoxEncryption] Binary encryption completed successfully');
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[NaClBoxEncryption] Original data size: [REDACTED]');
        console.log('[NaClBoxEncryption] Encrypted data size: [REDACTED]');
      }
      
      return {
        encryptedData: naclUtil.encodeBase64(encryptedData),
        encryptedKey: keyEncryption.encryptedContent,
        keyNonce: keyEncryption.nonce,
        dataNonce: naclUtil.encodeBase64(dataNonce),
        ephemeralPublicKey: keyEncryption.ephemeralPublicKey,
      };
    } catch (error) {
      console.error('[NaClBoxEncryption] Binary encryption failed:', error);
      throw error;
    }
  }
  
  /**
   * Decrypt binary data
   * 
   * @param encryptedData - Encrypted binary data (base64)
   * @param encryptedKey - Encrypted data key (base64)
   * @param keyNonce - Nonce used for key encryption (base64)
   * @param dataNonce - Nonce used for data encryption (base64)
   * @param ephemeralPublicKey - Sender's ephemeral public key (base64)
   * @param recipientPrivateKey - Recipient's private key (base64)
   * @returns Decrypted binary data
   */
  static async decryptBinary(
    encryptedData: string,
    encryptedKey: string,
    keyNonce: string,
    dataNonce: string,
    ephemeralPublicKey: string,
    recipientPrivateKey: string
  ): Promise<Uint8Array> {
    try {
      console.log('[NaClBoxEncryption] Decrypting binary data...');
      
      // Decrypt the data key first
      const dataKeyBytes = await this.decrypt(
        encryptedKey,
        keyNonce,
        ephemeralPublicKey,
        recipientPrivateKey
      );
      
      // Decrypt the actual data using the symmetric key
      const encryptedDataBytes = naclUtil.decodeBase64(encryptedData);
      const dataNonceBytes = naclUtil.decodeBase64(dataNonce);
      
      const decryptedData = (nacl as any).secretbox.open(
        encryptedDataBytes,
        dataNonceBytes,
        dataKeyBytes
      );
      
      if (!decryptedData) {
        throw new Error('Binary decryption failed - data key or nonce invalid');
      }
      
      console.log('[NaClBoxEncryption] Binary decryption completed successfully');
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[NaClBoxEncryption] Binary decrypted size: [REDACTED]');
      }
      
      return decryptedData;
    } catch (error) {
      console.error('[NaClBoxEncryption] Binary decryption failed:', error);
      throw error;
    }
  }
  
  /**
   * Helper to derive public key from private key
   * Uses TweetNaCl's supported method to derive public key from Curve25519 secret key
   */
  static async getPublicKeyFromPrivate(privateKey: string): Promise<string> {
    try {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[NaClBoxEncryption] Deriving public key from private key...');
      }
      
      // Decode the base64 private key to Uint8Array
      const secretKeyBytes = naclUtil.decodeBase64(privateKey);
      
      // Validate that the secret key is exactly 32 bytes (Curve25519 requirement)
      if (secretKeyBytes.length !== 32) {
        throw new Error(`Invalid private key length: expected 32 bytes, got ${secretKeyBytes.length}`);
      }
      
      // Derive the public key using TweetNaCl's keyPair.fromSecretKey method
      const keyPair = (nacl.box.keyPair as any).fromSecretKey(secretKeyBytes);
      
      // Encode the public key back to base64
      const publicKeyBase64 = naclUtil.encodeBase64(keyPair.publicKey);
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[NaClBoxEncryption] Public key derived successfully');
      }
      
      return publicKeyBase64;
    } catch (error) {
      console.error('[NaClBoxEncryption] Public key derivation failed:', error);
      throw new Error(`Public key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Generate a new keypair
   */
  static generateKeyPair(): { publicKey: string; secretKey: string } {
    const keyPair = nacl.box.keyPair();
    return {
      publicKey: naclUtil.encodeBase64(keyPair.publicKey),
      secretKey: naclUtil.encodeBase64(keyPair.secretKey),
    };
  }
  
  /**
   * Verify that encryption/decryption works correctly
   * Used for testing and verification
   */
  static async verifyEncryption(): Promise<boolean> {
    try {
      console.log('[NaClBoxEncryption] Running encryption verification test...');
      
      // Generate test keypairs
      const senderKeys = this.generateKeyPair();
      const recipientKeys = this.generateKeyPair();
      
      // Test data
      const testMessage = 'Hello, zero-knowledge encryption!';
      const testBinary = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 64]);
      
      // Test text encryption
      const encrypted = await this.encrypt(testMessage, recipientKeys.publicKey, senderKeys.secretKey);
      const decrypted = await this.decryptToString(
        encrypted.encryptedContent,
        encrypted.nonce,
        encrypted.ephemeralPublicKey,
        recipientKeys.secretKey
      );
      
      if (decrypted !== testMessage) {
        console.error('[NaClBoxEncryption] Text encryption verification failed');
        return false;
      }
      
      // Test binary encryption
      const binaryEncrypted = await this.encryptBinary(testBinary, recipientKeys.publicKey);
      const binaryDecrypted = await this.decryptBinary(
        binaryEncrypted.encryptedData,
        binaryEncrypted.encryptedKey,
        binaryEncrypted.keyNonce,
        binaryEncrypted.dataNonce,
        binaryEncrypted.ephemeralPublicKey,
        recipientKeys.secretKey
      );
      
      if (binaryDecrypted.length !== testBinary.length || 
          !binaryDecrypted.every((byte, index) => byte === testBinary[index])) {
        console.error('[NaClBoxEncryption] Binary encryption verification failed');
        return false;
      }
      
      console.log('[NaClBoxEncryption] ✅ All encryption verification tests passed!');
      return true;
    } catch (error) {
      console.error('[NaClBoxEncryption] Encryption verification failed:', error);
      return false;
    }
  }
}

export default NaClBoxEncryption;