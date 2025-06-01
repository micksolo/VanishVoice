import { encryptAudio, decryptAudio, generateEncryptionKey } from '../encryption';

describe('Encryption Utils', () => {
  it('should encrypt and decrypt audio data correctly', async () => {
    // Generate a test audio data (base64)
    const originalData = 'VGhpcyBpcyBhIHRlc3QgYXVkaW8gZmlsZSBjb250ZW50';
    
    // Generate encryption key
    const key = await generateEncryptionKey();
    expect(key).toBeTruthy();
    expect(key.length).toBeGreaterThan(0);
    
    // Encrypt the data
    const { encryptedData, iv } = await encryptAudio(originalData, key);
    expect(encryptedData).toBeTruthy();
    expect(iv).toBeTruthy();
    expect(encryptedData).not.toBe(originalData);
    
    // Decrypt the data
    const decryptedData = await decryptAudio(encryptedData, key, iv);
    expect(decryptedData).toBe(originalData);
  });
  
  it('should generate different keys each time', async () => {
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();
    
    expect(key1).not.toBe(key2);
  });
  
  it('should fail to decrypt with wrong key', async () => {
    const originalData = 'VGhpcyBpcyBhIHRlc3QgYXVkaW8gZmlsZSBjb250ZW50';
    const correctKey = await generateEncryptionKey();
    const wrongKey = await generateEncryptionKey();
    
    const { encryptedData, iv } = await encryptAudio(originalData, correctKey);
    const decryptedData = await decryptAudio(encryptedData, wrongKey, iv);
    
    expect(decryptedData).not.toBe(originalData);
  });
});