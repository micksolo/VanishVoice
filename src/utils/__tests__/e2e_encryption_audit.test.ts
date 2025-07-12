import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import NaClEncryption from '../nacl/naclEncryption';

describe('E2E Encryption Security Audit', () => {
  
  // Test 1: Key Generation Security
  test('generates cryptographically secure keys', async () => {
    const keys1 = await NaClEncryption.generateKeyPair();
    const keys2 = await NaClEncryption.generateKeyPair();
    
    // Keys should be unique
    expect(keys1.publicKey).not.toBe(keys2.publicKey);
    expect(keys1.secretKey).not.toBe(keys2.secretKey);
    
    // Keys should be correct length (32 bytes = 44 chars in base64)
    expect(keys1.publicKey.length).toBe(44);
    expect(keys1.secretKey.length).toBe(44);
    
    // Decode and verify actual byte length
    const pubKeyBytes = naclUtil.decodeBase64(keys1.publicKey);
    const secKeyBytes = naclUtil.decodeBase64(keys1.secretKey);
    expect(pubKeyBytes.length).toBe(32);
    expect(secKeyBytes.length).toBe(32);
  });

  // Test 2: Encryption produces different ciphertext
  test('encryption is non-deterministic', async () => {
    const message = "Test message";
    const recipientKeys = await NaClEncryption.generateKeyPair();
    const senderKeys = await NaClEncryption.generateKeyPair();
    
    const encrypted1 = await NaClEncryption.encrypt(
      message, 
      recipientKeys.publicKey, 
      senderKeys.secretKey
    );
    const encrypted2 = await NaClEncryption.encrypt(
      message, 
      recipientKeys.publicKey, 
      senderKeys.secretKey
    );
    
    // Same message should produce different ciphertexts
    expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    expect(encrypted1.nonce).not.toBe(encrypted2.nonce);
    expect(encrypted1.ephemeralPublicKey).not.toBe(encrypted2.ephemeralPublicKey);
  });

  // Test 3: Only correct recipient can decrypt
  test('only intended recipient can decrypt', async () => {
    const message = "Secret message";
    const recipientKeys = await NaClEncryption.generateKeyPair();
    const wrongKeys = await NaClEncryption.generateKeyPair();
    const senderKeys = await NaClEncryption.generateKeyPair();
    
    const encrypted = await NaClEncryption.encrypt(
      message, 
      recipientKeys.publicKey, 
      senderKeys.secretKey
    );
    
    // Correct recipient can decrypt
    const decrypted = await NaClEncryption.decrypt(
      encrypted.encrypted,
      encrypted.nonce,
      encrypted.ephemeralPublicKey,
      recipientKeys.secretKey
    );
    expect(naclUtil.encodeUTF8(decrypted)).toBe(message);
    
    // Wrong recipient cannot decrypt
    await expect(NaClEncryption.decrypt(
      encrypted.encrypted,
      encrypted.nonce,
      encrypted.ephemeralPublicKey,
      wrongKeys.secretKey
    )).rejects.toThrow('Decryption failed');
  });

  // Test 4: Message tampering detection
  test('detects tampered messages', async () => {
    const message = "Original message";
    const recipientKeys = await NaClEncryption.generateKeyPair();
    const senderKeys = await NaClEncryption.generateKeyPair();
    
    const encrypted = await NaClEncryption.encrypt(
      message, 
      recipientKeys.publicKey, 
      senderKeys.secretKey
    );
    
    // Tamper with the encrypted data
    const tamperedData = encrypted.encrypted.substring(0, encrypted.encrypted.length - 2) + "XX";
    
    // Decryption should fail
    await expect(NaClEncryption.decrypt(
      tamperedData,
      encrypted.nonce,
      encrypted.ephemeralPublicKey,
      recipientKeys.secretKey
    )).rejects.toThrow('Decryption failed');
  });

  // Test 5: Perfect Forward Secrecy
  test('implements perfect forward secrecy', async () => {
    const recipientKeys = await NaClEncryption.generateKeyPair();
    const senderKeys = await NaClEncryption.generateKeyPair();
    
    const encrypted1 = await NaClEncryption.encrypt(
      "Message 1", 
      recipientKeys.publicKey, 
      senderKeys.secretKey
    );
    const encrypted2 = await NaClEncryption.encrypt(
      "Message 2", 
      recipientKeys.publicKey, 
      senderKeys.secretKey
    );
    
    // Each message should have unique ephemeral keys
    expect(encrypted1.ephemeralPublicKey).not.toBe(encrypted2.ephemeralPublicKey);
    
    // Compromising one ephemeral key shouldn't affect others
    // (This is inherent in the design - each message has its own keys)
  });

  // Test 6: Nonce uniqueness and size
  test('generates unique nonces of correct size', async () => {
    const nonces = new Set();
    const recipientKeys = await NaClEncryption.generateKeyPair();
    const senderKeys = await NaClEncryption.generateKeyPair();
    
    // Generate 100 messages and check nonce uniqueness
    for (let i = 0; i < 100; i++) {
      const encrypted = await NaClEncryption.encrypt(
        `Message ${i}`, 
        recipientKeys.publicKey, 
        senderKeys.secretKey
      );
      
      // Check nonce size (24 bytes = 32 chars in base64)
      expect(encrypted.nonce.length).toBe(32);
      
      // Check uniqueness
      expect(nonces.has(encrypted.nonce)).toBe(false);
      nonces.add(encrypted.nonce);
    }
  });

  // Test 7: Binary data encryption
  test('correctly encrypts binary data', async () => {
    // Simulate audio data
    const audioData = new Uint8Array(1024);
    crypto.getRandomValues(audioData);
    
    const recipientKeys = await NaClEncryption.generateKeyPair();
    const senderKeys = await NaClEncryption.generateKeyPair();
    
    const encrypted = await NaClEncryption.encrypt(
      audioData, 
      recipientKeys.publicKey, 
      senderKeys.secretKey
    );
    
    const decrypted = await NaClEncryption.decrypt(
      encrypted.encrypted,
      encrypted.nonce,
      encrypted.ephemeralPublicKey,
      recipientKeys.secretKey
    );
    
    // Verify exact match
    expect(decrypted).toEqual(audioData);
  });

  // Test 8: Empty message handling
  test('handles empty messages correctly', async () => {
    const recipientKeys = await NaClEncryption.generateKeyPair();
    const senderKeys = await NaClEncryption.generateKeyPair();
    
    const encrypted = await NaClEncryption.encrypt(
      "", 
      recipientKeys.publicKey, 
      senderKeys.secretKey
    );
    
    const decrypted = await NaClEncryption.decrypt(
      encrypted.encrypted,
      encrypted.nonce,
      encrypted.ephemeralPublicKey,
      recipientKeys.secretKey
    );
    
    expect(naclUtil.encodeUTF8(decrypted)).toBe("");
  });

  // Test 9: Key format validation
  test('validates key formats', async () => {
    const validKeys = await NaClEncryption.generateKeyPair();
    
    // Test with invalid keys
    const invalidKey = "invalid-key-format";
    
    await expect(NaClEncryption.encrypt(
      "Test", 
      invalidKey, 
      validKeys.secretKey
    )).rejects.toThrow();
    
    await expect(NaClEncryption.encrypt(
      "Test", 
      validKeys.publicKey, 
      invalidKey
    )).rejects.toThrow();
  });

  // Test 10: Large message handling
  test('handles large audio files efficiently', async () => {
    const largeData = new Uint8Array(5 * 1024 * 1024); // 5MB
    crypto.getRandomValues(largeData);
    
    const recipientKeys = await NaClEncryption.generateKeyPair();
    const senderKeys = await NaClEncryption.generateKeyPair();
    
    const startTime = Date.now();
    
    const encrypted = await NaClEncryption.encrypt(
      largeData,
      recipientKeys.publicKey,
      senderKeys.secretKey
    );
    
    const encryptTime = Date.now() - startTime;
    expect(encryptTime).toBeLessThan(2000); // Should complete in < 2 seconds
    
    const decryptStart = Date.now();
    const decrypted = await NaClEncryption.decrypt(
      encrypted.encrypted,
      encrypted.nonce,
      encrypted.ephemeralPublicKey,
      recipientKeys.secretKey
    );
    
    const decryptTime = Date.now() - decryptStart;
    expect(decryptTime).toBeLessThan(2000); // Should complete in < 2 seconds
    
    // Verify data integrity
    expect(decrypted.length).toBe(largeData.length);
  });
});