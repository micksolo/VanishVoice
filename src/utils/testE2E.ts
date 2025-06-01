import { encryptForRecipient, decryptFromSender, generateUserKeyPair } from './e2eEncryption';

export const testE2EEncryption = async () => {
  try {
    console.log('=== Testing E2E Encryption ===');
    
    // Generate keys for sender and recipient
    const senderKeys = await generateUserKeyPair();
    const recipientKeys = await generateUserKeyPair();
    
    console.log('Generated keys successfully');
    
    // Test data (simulate base64 audio)
    const testAudioBase64 = 'VGhpcyBpcyBhIHRlc3QgYXVkaW8gZmlsZSBjb250ZW50IGluIGJhc2U2NA==';
    console.log('Original data:', testAudioBase64);
    
    // Encrypt
    const encrypted = await encryptForRecipient(
      testAudioBase64,
      recipientKeys.publicKey,
      senderKeys.privateKey
    );
    
    console.log('Encrypted successfully');
    console.log('Encrypted data length:', encrypted.encryptedData.length);
    console.log('IV:', encrypted.iv);
    
    // Decrypt
    const decrypted = await decryptFromSender(
      encrypted.encryptedData,
      encrypted.encryptedKey,
      encrypted.iv,
      recipientKeys.privateKey,
      senderKeys.publicKey
    );
    
    console.log('Decrypted data:', decrypted);
    console.log('Match:', testAudioBase64 === decrypted);
    console.log('============================');
    
    return testAudioBase64 === decrypted;
  } catch (error) {
    console.error('E2E test failed:', error);
    return false;
  }
};