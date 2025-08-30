import { encryptForRecipient, decryptFromSender, generateUserKeyPair } from './e2eEncryptionFixed';
import { Buffer } from 'buffer';

export const testE2EDetailed = async () => {
  try {
    console.log('=== Detailed E2E Encryption Test ===');
    
    // Generate keys
    const senderKeys = await generateUserKeyPair();
    const recipientKeys = await generateUserKeyPair();
    
    if (__DEV__) {
      console.log('Sender private key: [REDACTED]');
      console.log('Sender public key: [REDACTED]');
      console.log('Recipient private key: [REDACTED]');
      console.log('Recipient public key: [REDACTED]');
    }
    
    // Test with simple data first
    const testData = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
    console.log('\nTest data:', testData);
    console.log('Decoded test data:', Buffer.from(testData, 'base64').toString('utf8'));
    
    // Encrypt
    const encrypted = await encryptForRecipient(
      testData,
      recipientKeys.publicKey,
      senderKeys.privateKey
    );
    
    console.log('\nEncryption result:');
    console.log('- Encrypted data:', encrypted.encryptedData);
    console.log('- Encrypted key:', encrypted.encryptedKey);
    console.log('- IV:', encrypted.iv);
    
    // Decrypt
    const decrypted = await decryptFromSender(
      encrypted.encryptedData,
      encrypted.encryptedKey,
      encrypted.iv,
      recipientKeys.privateKey,
      senderKeys.publicKey
    );
    
    console.log('\nDecrypted data:', decrypted);
    console.log('Match:', testData === decrypted);
    
    if (testData === decrypted) {
      console.log('✅ Encryption/Decryption working!');
    } else {
      console.log('❌ Encryption/Decryption FAILED');
      
      // Compare byte by byte
      const origBytes = Buffer.from(testData, 'base64');
      const decBytes = Buffer.from(decrypted, 'base64');
      
      console.log('\nByte comparison:');
      console.log('Original bytes:', origBytes);
      console.log('Decrypted bytes:', decBytes);
      
      if (origBytes.length !== decBytes.length) {
        console.log('Length mismatch! Original:', origBytes.length, 'Decrypted:', decBytes.length);
      }
    }
    
    console.log('=====================================');
    
    return testData === decrypted;
  } catch (error) {
    console.error('Detailed test failed:', error);
    return false;
  }
};