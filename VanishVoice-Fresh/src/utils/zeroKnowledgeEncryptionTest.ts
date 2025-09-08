/**
 * Zero-Knowledge Encryption Test
 * 
 * This test verifies that all encryption modules work correctly with the Buffer polyfill
 * and that zero-knowledge encryption is functioning end-to-end.
 * 
 * Run this test after the Buffer polyfill fix to verify everything works.
 */

import NaClBoxEncryption from './NaClBoxEncryption';
import { verifyE2EAudioEncryption } from './secureE2EAudioStorage';
import { SecureE2EVideoStorageFastAndroid } from './secureE2EVideoStorageFastAndroid';

export interface TestResult {
  module: string;
  test: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

export class ZeroKnowledgeEncryptionTest {
  private results: TestResult[] = [];

  /**
   * Run comprehensive test suite for zero-knowledge encryption
   */
  public async runAllTests(): Promise<{ passed: number; failed: number; results: TestResult[] }> {
    console.log('🧪 [ZK Test] Starting comprehensive zero-knowledge encryption tests...');
    console.log('================================');

    this.results = [];

    // Test 1: Buffer polyfill verification
    await this.testBufferPolyfill();

    // Test 2: NaCl basic encryption
    await this.testNaClEncryption();

    // Test 3: NaCl binary encryption (used for audio/video)
    await this.testNaClBinaryEncryption();

    // Test 4: Audio encryption verification
    await this.testAudioEncryption();

    // Test 5: Video encryption verification
    await this.testVideoEncryption();

    // Test 6: Large data encryption (performance test)
    await this.testLargeDataEncryption();

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log('\n🧪 [ZK Test] COMPREHENSIVE TEST RESULTS:');
    console.log('================================');
    console.log(`✅ PASSED: ${passed}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log(`📊 TOTAL: ${this.results.length}`);

    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Zero-knowledge encryption is working correctly!');
      console.log('✅ Buffer polyfill fixed');
      console.log('✅ Voice messages should work');
      console.log('✅ Video messages should work');
      console.log('✅ Text messages should work');
    } else {
      console.log('\n❌ SOME TESTS FAILED! Issues still remain:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`   • ${result.module} - ${result.test}: ${result.error}`);
      });
    }

    return { passed, failed, results: this.results };
  }

  /**
   * Test 1: Verify Buffer polyfill is working
   */
  private async testBufferPolyfill(): Promise<void> {
    const start = Date.now();
    try {
      console.log('[ZK Test] Testing Buffer polyfill...');

      // Test global.Buffer exists
      if (typeof global.Buffer === 'undefined') {
        throw new Error('global.Buffer is undefined - polyfill not loaded');
      }

      // Test Buffer operations
      const testString = 'Hello, Buffer!';
      const buffer = global.Buffer.from(testString, 'utf8');
      const base64 = buffer.toString('base64');
      const restored = global.Buffer.from(base64, 'base64').toString('utf8');

      if (restored !== testString) {
        throw new Error('Buffer operations failed - data corruption');
      }

      // Test large buffer operations (similar to what audio/video uses)
      const largeData = new Uint8Array(1024 * 1024); // 1MB
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      const largeBuffer = global.Buffer.from(largeData);
      const largeBase64 = largeBuffer.toString('base64');
      const restoredLarge = new Uint8Array(global.Buffer.from(largeBase64, 'base64'));

      if (restoredLarge.length !== largeData.length) {
        throw new Error('Large buffer operations failed - size mismatch');
      }

      this.results.push({
        module: 'Buffer',
        test: 'Polyfill functionality',
        passed: true,
        duration: Date.now() - start
      });

      console.log('✅ [ZK Test] Buffer polyfill test PASSED');
    } catch (error: any) {
      this.results.push({
        module: 'Buffer',
        test: 'Polyfill functionality',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      });

      console.error('❌ [ZK Test] Buffer polyfill test FAILED:', error.message);
    }
  }

  /**
   * Test 2: Basic NaCl encryption functionality
   */
  private async testNaClEncryption(): Promise<void> {
    const start = Date.now();
    try {
      console.log('[ZK Test] Testing NaCl basic encryption...');

      const verified = await NaClBoxEncryption.verifyEncryption();
      if (!verified) {
        throw new Error('NaClBoxEncryption verification failed');
      }

      this.results.push({
        module: 'NaClBoxEncryption',
        test: 'Basic encryption verification',
        passed: true,
        duration: Date.now() - start
      });

      console.log('✅ [ZK Test] NaCl basic encryption test PASSED');
    } catch (error: any) {
      this.results.push({
        module: 'NaClBoxEncryption',
        test: 'Basic encryption verification',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      });

      console.error('❌ [ZK Test] NaCl basic encryption test FAILED:', error.message);
    }
  }

  /**
   * Test 3: NaCl binary encryption (used for media files)
   */
  private async testNaClBinaryEncryption(): Promise<void> {
    const start = Date.now();
    try {
      console.log('[ZK Test] Testing NaCl binary encryption...');

      // Generate test keys
      const keys = NaClBoxEncryption.generateKeyPair();

      // Test binary data (simulating audio/video)
      const testData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAG4czRU'; // Base64 test data
      
      // Encrypt
      const encrypted = await NaClBoxEncryption.encryptBinary(testData, keys.publicKey);
      
      // Verify encryption structure
      if (!encrypted.encryptedData || !encrypted.encryptedKey || !encrypted.keyNonce || 
          !encrypted.dataNonce || !encrypted.ephemeralPublicKey) {
        throw new Error('Binary encryption result incomplete');
      }

      // Decrypt
      const decrypted = await NaClBoxEncryption.decryptBinary(
        encrypted.encryptedData,
        encrypted.encryptedKey,
        encrypted.keyNonce,
        encrypted.dataNonce,
        encrypted.ephemeralPublicKey,
        keys.secretKey
      );

      const decryptedBase64 = global.Buffer.from(decrypted).toString('base64');
      
      if (decryptedBase64 !== testData) {
        throw new Error('Binary encryption/decryption failed - data mismatch');
      }

      this.results.push({
        module: 'NaClBoxEncryption',
        test: 'Binary encryption',
        passed: true,
        duration: Date.now() - start
      });

      console.log('✅ [ZK Test] NaCl binary encryption test PASSED');
    } catch (error: any) {
      this.results.push({
        module: 'NaClBoxEncryption',
        test: 'Binary encryption',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      });

      console.error('❌ [ZK Test] NaCl binary encryption test FAILED:', error.message);
    }
  }

  /**
   * Test 4: Audio encryption end-to-end
   */
  private async testAudioEncryption(): Promise<void> {
    const start = Date.now();
    try {
      console.log('[ZK Test] Testing audio encryption...');

      const verified = await verifyE2EAudioEncryption();
      if (!verified) {
        throw new Error('Audio encryption verification failed');
      }

      this.results.push({
        module: 'AudioEncryption',
        test: 'E2E audio encryption',
        passed: true,
        duration: Date.now() - start
      });

      console.log('✅ [ZK Test] Audio encryption test PASSED');
    } catch (error: any) {
      this.results.push({
        module: 'AudioEncryption',
        test: 'E2E audio encryption',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      });

      console.error('❌ [ZK Test] Audio encryption test FAILED:', error.message);
    }
  }

  /**
   * Test 5: Video encryption verification
   */
  private async testVideoEncryption(): Promise<void> {
    const start = Date.now();
    try {
      console.log('[ZK Test] Testing video encryption...');

      const verified = await SecureE2EVideoStorageFastAndroid.verifyZeroKnowledgeVideoEncryption();
      if (!verified) {
        throw new Error('Video encryption verification failed');
      }

      this.results.push({
        module: 'VideoEncryption',
        test: 'Zero-knowledge video encryption',
        passed: true,
        duration: Date.now() - start
      });

      console.log('✅ [ZK Test] Video encryption test PASSED');
    } catch (error: any) {
      this.results.push({
        module: 'VideoEncryption',
        test: 'Zero-knowledge video encryption',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      });

      console.error('❌ [ZK Test] Video encryption test FAILED:', error.message);
    }
  }

  /**
   * Test 6: Large data encryption performance
   */
  private async testLargeDataEncryption(): Promise<void> {
    const start = Date.now();
    try {
      console.log('[ZK Test] Testing large data encryption (performance)...');

      // Generate test keys
      const keys = NaClBoxEncryption.generateKeyPair();

      // Create 5MB of test data (typical large video message size)
      const largeData = new Array(5 * 1024 * 1024).fill(0).map((_, i) => i % 256);
      const largeBase64 = global.Buffer.from(largeData).toString('base64');

      console.log('[ZK Test] Encrypting 5MB test data...');
      const encryptStart = Date.now();
      
      const encrypted = await NaClBoxEncryption.encryptBinary(largeBase64, keys.publicKey);
      const encryptTime = (Date.now() - encryptStart) / 1000;
      
      console.log(`[ZK Test] Encryption took ${encryptTime.toFixed(2)}s`);

      console.log('[ZK Test] Decrypting 5MB test data...');
      const decryptStart = Date.now();
      
      const decrypted = await NaClBoxEncryption.decryptBinary(
        encrypted.encryptedData,
        encrypted.encryptedKey,
        encrypted.keyNonce,
        encrypted.dataNonce,
        encrypted.ephemeralPublicKey,
        keys.secretKey
      );
      
      const decryptTime = (Date.now() - decryptStart) / 1000;
      
      console.log(`[ZK Test] Decryption took ${decryptTime.toFixed(2)}s`);

      const decryptedBase64 = global.Buffer.from(decrypted).toString('base64');
      
      if (decryptedBase64 !== largeBase64) {
        throw new Error('Large data encryption/decryption failed');
      }

      const totalTime = Date.now() - start;

      this.results.push({
        module: 'Performance',
        test: 'Large data encryption (5MB)',
        passed: true,
        duration: totalTime
      });

      console.log(`✅ [ZK Test] Large data encryption test PASSED (${(totalTime / 1000).toFixed(2)}s total)`);
      console.log(`   📊 Performance: Encrypt ${encryptTime.toFixed(2)}s, Decrypt ${decryptTime.toFixed(2)}s`);
    } catch (error: any) {
      this.results.push({
        module: 'Performance',
        test: 'Large data encryption (5MB)',
        passed: false,
        error: error.message,
        duration: Date.now() - start
      });

      console.error('❌ [ZK Test] Large data encryption test FAILED:', error.message);
    }
  }

  /**
   * Get test results summary
   */
  public getResults(): TestResult[] {
    return this.results;
  }

  /**
   * Quick test to run from console for debugging
   */
  public static async quickTest(): Promise<void> {
    console.log('🧪 Running quick zero-knowledge encryption test...');
    const tester = new ZeroKnowledgeEncryptionTest();
    const results = await tester.runAllTests();
    
    if (results.failed === 0) {
      console.log('\n🎉 QUICK TEST PASSED! Encryption is working.');
    } else {
      console.log('\n❌ QUICK TEST FAILED! Check the logs above for details.');
    }
  }
}

// Export for console testing
if (typeof global !== 'undefined') {
  (global as any).testZeroKnowledgeEncryption = ZeroKnowledgeEncryptionTest.quickTest;
}

export default ZeroKnowledgeEncryptionTest;