// Debug utilities for E2E encryption

export const debugE2EDecryption = async (
  encryptedData: string,
  decryptedData: string,
  localUri: string
) => {
  console.log('=== E2E Decryption Debug ===');
  console.log('Encrypted data length:', encryptedData.length);
  console.log('Encrypted data preview:', encryptedData.substring(0, 50) + '...');
  console.log('Decrypted data length:', decryptedData.length);
  console.log('Decrypted data preview:', decryptedData.substring(0, 50) + '...');
  console.log('Local file URI:', localUri);
  console.log('========================');
};

export const debugAudioFile = async (uri: string) => {
  try {
    const FileSystem = require('expo-file-system');
    const fileInfo = await FileSystem.getInfoAsync(uri);
    console.log('=== Audio File Debug ===');
    console.log('File exists:', fileInfo.exists);
    console.log('File size:', fileInfo.size);
    console.log('File URI:', fileInfo.uri);
    console.log('=======================');
  } catch (error) {
    console.error('Error debugging audio file:', error);
  }
};