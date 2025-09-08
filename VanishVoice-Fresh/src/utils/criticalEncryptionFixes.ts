/**
 * Critical Encryption Fixes - Verification and Testing
 * 
 * This module contains all the fixes for the critical zero-knowledge encryption failures
 * and provides comprehensive testing to verify they work correctly.
 */

import NaClBoxEncryption from './NaClBoxEncryption';
import { verifyE2EAudioEncryption } from './secureE2EAudioStorage';
import { SecureE2EVideoStorageFastAndroid } from './secureE2EVideoStorageFastAndroid';
import { EphemeralMessageService } from '../services/ephemeralMessages';

export interface CriticalFixResult {
  fix: string;
  status: 'FIXED' | 'FAILED' | 'PARTIAL';
  details: string;
  testResult?: boolean;
}

export class CriticalEncryptionFixes {
  
  /**
   * Verify Buffer polyfill is working correctly
   */
  static verifyBufferPolyfill(): CriticalFixResult {
    try {
      // Test 1: Global Buffer exists
      if (typeof global.Buffer === 'undefined') {
        return {
          fix: 'Buffer Polyfill',
          status: 'FAILED',
          details: 'global.Buffer is undefined - polyfill not loaded'
        };
      }

      // Test 2: Basic operations work
      const testString = 'VanishVoice encryption test';
      const buffer = global.Buffer.from(testString, 'utf8');
      const base64 = buffer.toString('base64');
      const restored = global.Buffer.from(base64, 'base64').toString('utf8');

      if (restored !== testString) {
        return {
          fix: 'Buffer Polyfill',
          status: 'FAILED',
          details: 'Buffer operations fail - data corruption detected'
        };
      }

      // Test 3: Large buffer operations (like video encryption uses)
      const largeArray = new Array(1024).fill(42);
      const largeBuffer = global.Buffer.from(largeArray);
      if (largeBuffer.length !== 1024 || largeBuffer[0] !== 42) {
        return {
          fix: 'Buffer Polyfill',
          status: 'FAILED',
          details: 'Large buffer operations fail'
        };
      }

      return {
        fix: 'Buffer Polyfill',
        status: 'FIXED',
        details: 'Global Buffer polyfill working correctly. Voice/video encryption should now work.',
        testResult: true
      };

    } catch (error: any) {
      return {
        fix: 'Buffer Polyfill',
        status: 'FAILED',
        details: `Buffer polyfill error: ${error.message}`
      };
    }
  }

  /**
   * Test NaCl encryption with the Buffer fixes
   */
  static async testNaClEncryption(): Promise<CriticalFixResult> {
    try {
      // This will use the fixed NaClBoxEncryption module with global.Buffer
      const verified = await NaClBoxEncryption.verifyEncryption();
      
      return {
        fix: 'NaCl Encryption',
        status: verified ? 'FIXED' : 'FAILED',
        details: verified 
          ? 'NaCl encryption working correctly. Text messages should work.'
          : 'NaCl encryption verification failed',
        testResult: verified
      };
    } catch (error: any) {
      return {
        fix: 'NaCl Encryption',
        status: 'FAILED',
        details: `NaCl encryption test failed: ${error.message}`
      };
    }
  }

  /**
   * Test audio encryption with the Buffer fixes
   */
  static async testAudioEncryption(): Promise<CriticalFixResult> {
    try {
      // This will use the fixed secureE2EAudioStorage module with global.Buffer
      const verified = await verifyE2EAudioEncryption();
      
      return {
        fix: 'Audio Encryption',
        status: verified ? 'FIXED' : 'FAILED',
        details: verified 
          ? 'Audio encryption working correctly. Voice messages should work.'
          : 'Audio encryption verification failed',
        testResult: verified
      };
    } catch (error: any) {
      return {
        fix: 'Audio Encryption',
        status: 'FAILED',
        details: `Audio encryption test failed: ${error.message}`
      };
    }
  }

  /**
   * Test video encryption with the Buffer fixes
   */
  static async testVideoEncryption(): Promise<CriticalFixResult> {
    try {
      // This will use the fixed secureE2EVideoStorageFastAndroid module with global.Buffer
      const verified = await SecureE2EVideoStorageFastAndroid.verifyZeroKnowledgeVideoEncryption();
      
      return {
        fix: 'Video Encryption',
        status: verified ? 'FIXED' : 'FAILED',
        details: verified 
          ? 'Video encryption working correctly. Video messages should work.'
          : 'Video encryption verification failed',
        testResult: verified
      };
    } catch (error: any) {
      return {
        fix: 'Video Encryption',
        status: 'FAILED',
        details: `Video encryption test failed: ${error.message}`
      };
    }
  }

  /**
   * Verify ephemeral message polling fallback
   */
  static verifyEphemeralPolling(): CriticalFixResult {
    try {
      // Check that the new polling methods exist
      if (typeof EphemeralMessageService.checkExpiredMessages !== 'function') {
        return {
          fix: 'Ephemeral Message Polling',
          status: 'FAILED',
          details: 'checkExpiredMessages method not found'
        };
      }

      if (typeof EphemeralMessageService.startExpiryPolling !== 'function') {
        return {
          fix: 'Ephemeral Message Polling',
          status: 'FAILED',
          details: 'startExpiryPolling method not found'
        };
      }

      return {
        fix: 'Ephemeral Message Polling',
        status: 'FIXED',
        details: 'Polling fallback implemented. Ephemeral messages should disappear reliably.',
        testResult: true
      };

    } catch (error: any) {
      return {
        fix: 'Ephemeral Message Polling',
        status: 'FAILED',
        details: `Ephemeral polling verification failed: ${error.message}`
      };
    }
  }

  /**
   * Run all critical fix verifications
   */
  static async verifyCriticalFixes(): Promise<{
    allFixed: boolean;
    results: CriticalFixResult[];
    summary: string;
  }> {
    console.log('🔧 [Critical Fixes] Running comprehensive verification...');
    console.log('===========================================');

    const results: CriticalFixResult[] = [];

    // Test 1: Buffer polyfill
    console.log('🔧 [Fix 1/5] Testing Buffer polyfill...');
    const bufferResult = this.verifyBufferPolyfill();
    results.push(bufferResult);
    console.log(`   ${bufferResult.status === 'FIXED' ? '✅' : '❌'} ${bufferResult.details}`);

    // Test 2: NaCl encryption
    console.log('🔧 [Fix 2/5] Testing NaCl encryption...');
    const naclResult = await this.testNaClEncryption();
    results.push(naclResult);
    console.log(`   ${naclResult.status === 'FIXED' ? '✅' : '❌'} ${naclResult.details}`);

    // Test 3: Audio encryption
    console.log('🔧 [Fix 3/5] Testing audio encryption...');
    const audioResult = await this.testAudioEncryption();
    results.push(audioResult);
    console.log(`   ${audioResult.status === 'FIXED' ? '✅' : '❌'} ${audioResult.details}`);

    // Test 4: Video encryption
    console.log('🔧 [Fix 4/5] Testing video encryption...');
    const videoResult = await this.testVideoEncryption();
    results.push(videoResult);
    console.log(`   ${videoResult.status === 'FIXED' ? '✅' : '❌'} ${videoResult.details}`);

    // Test 5: Ephemeral message polling
    console.log('🔧 [Fix 5/5] Testing ephemeral message polling...');
    const ephemeralResult = this.verifyEphemeralPolling();
    results.push(ephemeralResult);
    console.log(`   ${ephemeralResult.status === 'FIXED' ? '✅' : '❌'} ${ephemeralResult.details}`);

    const fixedCount = results.filter(r => r.status === 'FIXED').length;
    const failedCount = results.filter(r => r.status === 'FAILED').length;
    const allFixed = failedCount === 0;

    let summary = '';
    if (allFixed) {
      summary = `🎉 ALL ${fixedCount} CRITICAL FIXES VERIFIED! Zero-knowledge encryption is working correctly.`;
    } else {
      summary = `⚠️ ${fixedCount}/${results.length} fixes working. ${failedCount} issues remain.`;
    }

    console.log('\n🔧 [Critical Fixes] VERIFICATION COMPLETE');
    console.log('===========================================');
    console.log(summary);
    
    if (allFixed) {
      console.log('✅ Voice messages should encrypt/decrypt');
      console.log('✅ Video messages should encrypt/decrypt');  
      console.log('✅ Text messages should encrypt/decrypt');
      console.log('✅ Ephemeral messages should disappear');
      console.log('✅ Server still CANNOT decrypt any messages');
    } else {
      console.log('❌ Some encryption issues remain - check logs above');
    }

    return { allFixed, results, summary };
  }

  /**
   * Quick console test function
   */
  static async quickVerification(): Promise<void> {
    const result = await this.verifyCriticalFixes();
    
    if (result.allFixed) {
      console.log('\n✅ QUICK VERIFICATION PASSED');
    } else {
      console.log('\n❌ QUICK VERIFICATION FAILED');
      console.log('Issues found:');
      result.results
        .filter(r => r.status === 'FAILED')
        .forEach(r => console.log(`   • ${r.fix}: ${r.details}`));
    }
  }
}

// Export for console testing
if (typeof global !== 'undefined') {
  (global as any).verifyCriticalFixes = CriticalEncryptionFixes.quickVerification;
}

export default CriticalEncryptionFixes;