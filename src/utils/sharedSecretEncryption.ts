/**
 * Shared Secret Encryption for Friend Messages
 * 
 * This module provides symmetric encryption using a shared secret
 * that both friends can derive independently without key exchange.
 */

import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import naclUtil from 'tweetnacl-util';

class SharedSecretEncryption {
  /**
   * Derive a shared secret for a friendship
   * Both friends will generate the same secret
   */
  static async deriveSharedSecret(userId1: string, userId2: string): Promise<string> {
    console.log('[SharedSecretEncryption] Deriving shared secret for:', userId1, userId2);
    
    // Sort IDs to ensure both friends generate the same secret
    const sortedIds = [userId1, userId2].sort();
    const combinedId = sortedIds.join(':');
    
    console.log('[SharedSecretEncryption] Combined ID:', combinedId);
    
    // Generate a deterministic key for this friendship
    const sharedKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `vanishvoice:friendship:${combinedId}:shared_key_v2`,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    
    console.log('[SharedSecretEncryption] Shared key (first 10 chars):', sharedKey.substring(0, 10));
    
    return sharedKey;
  }

  /**
   * Encrypt a message using shared secret
   */
  static async encrypt(
    message: string,
    sharedSecret: string
  ): Promise<{
    encrypted: string;
    nonce: string;
  }> {
    try {
      // Generate a random nonce
      const nonceBytes = await Crypto.getRandomBytesAsync(16);
      const nonce = Buffer.from(nonceBytes).toString('base64');
      
      // Create encryption key by combining shared secret and nonce
      const encryptionKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        sharedSecret + nonce,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      
      // Convert message to buffer
      const messageBuffer = Buffer.from(message, 'utf8');
      const keyBuffer = Buffer.from(encryptionKey, 'hex');
      
      // Simple XOR encryption with key stretching
      const encrypted = Buffer.alloc(messageBuffer.length);
      for (let i = 0; i < messageBuffer.length; i++) {
        encrypted[i] = messageBuffer[i] ^ keyBuffer[i % keyBuffer.length];
      }
      
      // Add authentication tag
      const authTag = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        encrypted.toString('base64') + sharedSecret + nonce,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      
      // Combine encrypted data and auth tag
      const authTagBuffer = Buffer.from(authTag, 'base64').slice(0, 16);
      const combined = Buffer.concat([authTagBuffer, encrypted]);
      
      return {
        encrypted: combined.toString('base64'),
        nonce: nonce
      };
    } catch (error) {
      console.error('[SharedSecretEncryption] Encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt a message using shared secret
   */
  static async decrypt(
    encryptedData: string,
    nonce: string,
    sharedSecret: string
  ): Promise<string> {
    try {
      // Parse encrypted data
      const combined = Buffer.from(encryptedData, 'base64');
      
      if (combined.length < 16) {
        throw new Error('Invalid encrypted data - too short');
      }
      
      // Extract auth tag and encrypted content
      const authTag = combined.slice(0, 16);
      const encrypted = combined.slice(16);
      
      // Verify authentication tag
      const expectedTag = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        encrypted.toString('base64') + sharedSecret + nonce,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      
      const expectedTagBuffer = Buffer.from(expectedTag, 'base64').slice(0, 16);
      if (!authTag.equals(expectedTagBuffer)) {
        throw new Error('Authentication failed - message may have been tampered with');
      }
      
      // Create decryption key
      const decryptionKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        sharedSecret + nonce,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      
      const keyBuffer = Buffer.from(decryptionKey, 'hex');
      
      // XOR decryption
      const decrypted = Buffer.alloc(encrypted.length);
      for (let i = 0; i < encrypted.length; i++) {
        decrypted[i] = encrypted[i] ^ keyBuffer[i % keyBuffer.length];
      }
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('[SharedSecretEncryption] Decryption failed:', error);
      throw error;
    }
  }
}

export default SharedSecretEncryption;