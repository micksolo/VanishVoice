import { encryptForRecipient as encryptOld, decryptFromSender as decryptOld, generateUserKeyPair as generateOld } from './e2eEncryption';
import { encryptForRecipient, decryptFromSender, generateUserKeyPair } from './e2eEncryptionFixed';

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
    console.log('Decrypted length:', decrypted.length);
    console.log('Original length:', testAudioBase64.length);
    console.log('Match:', testAudioBase64 === decrypted);
    
    // Try to decode to see what we got
    try {
      const decoded = Buffer.from(decrypted, 'base64').toString('utf8');
      console.log('Decoded content:', decoded);
    } catch (e) {
      console.log('Could not decode as UTF-8');
    }
    
    console.log('============================');
    
    return testAudioBase64 === decrypted;
  } catch (error) {
    console.error('E2E test failed:', error);
    return false;
  }
};