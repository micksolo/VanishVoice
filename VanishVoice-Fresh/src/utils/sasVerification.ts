import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import { 
  generateVerificationEmojis, 
  generateKeyFingerprint,
  VERIFICATION_EMOJIS,
  VERIFICATION_SECURITY_INFO
} from './verificationHelpers';

/**
 * Short Authentication String (SAS) Verification System
 * 
 * This module implements SAS-based MITM (Man-in-the-Middle) attack protection
 * for anonymous chat conversations. It uses emoji sequences that both parties
 * must visually confirm to ensure their connection is secure.
 * 
 * Security Model:
 * 1. Both users perform key exchange through the server
 * 2. SAS emojis are generated deterministically from both public keys
 * 3. Users compare emoji sequences out-of-band (visually/verbally)
 * 4. If emojis match, the connection is verified as MITM-free
 * 5. If emojis don't match, a MITM attack is detected
 */

export interface SASVerificationResult {
  success: boolean;
  emojis: string[];
  fingerprint: string;
  securityLevel: 'verified' | 'unverified' | 'compromised';
  timestamp: Date;
  error?: string;
}

export interface SASVerificationData {
  emojis: string[];
  fingerprint: string;
  sessionId: string;
  verified: boolean;
  timestamp: Date;
  securityBits: number;
}

export class SASVerification {
  private verificationData: SASVerificationData | null = null;
  private isVerified: boolean = false;
  
  /**
   * Generates SAS verification data from two public keys and session context
   * This is deterministic - both parties will generate identical emojis
   */
  generateSAS(
    myPublicKey: Uint8Array,
    partnerPublicKey: Uint8Array,
    sessionContext: string
  ): SASVerificationData {
    try {
      console.log('[SASVerification] Generating SAS verification data...');
      
      // Generate verification emojis using both public keys
      const emojis = generateVerificationEmojis(
        myPublicKey,
        partnerPublicKey,
        sessionContext
      );
      
      // Generate key fingerprint for integrity checking
      const fingerprint = generateKeyFingerprint(myPublicKey, partnerPublicKey);
      
      const verificationData: SASVerificationData = {
        emojis,
        fingerprint,
        sessionId: sessionContext,
        verified: false,
        timestamp: new Date(),
        securityBits: VERIFICATION_SECURITY_INFO.securityBits
      };
      
      this.verificationData = verificationData;
      
      console.log('[SASVerification] Generated SAS emojis:', emojis.join(' '));
      console.log('[SASVerification] Key fingerprint:', fingerprint);
      console.log('[SASVerification] Security bits:', VERIFICATION_SECURITY_INFO.securityBits);
      
      return verificationData;
    } catch (error) {
      console.error('[SASVerification] Error generating SAS:', error);
      throw new Error(`SAS generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Marks the current SAS verification as confirmed by both parties
   * This should only be called after users have confirmed emoji sequences match
   */
  confirmVerification(): SASVerificationResult {
    if (!this.verificationData) {
      return {
        success: false,
        emojis: [],
        fingerprint: '',
        securityLevel: 'compromised',
        timestamp: new Date(),
        error: 'No verification data available'
      };
    }
    
    try {
      this.verificationData.verified = true;
      this.verificationData.timestamp = new Date();
      this.isVerified = true;
      
      console.log('[SASVerification] Connection verified successfully');
      
      return {
        success: true,
        emojis: this.verificationData.emojis,
        fingerprint: this.verificationData.fingerprint,
        securityLevel: 'verified',
        timestamp: this.verificationData.timestamp
      };
    } catch (error) {
      console.error('[SASVerification] Error confirming verification:', error);
      return {
        success: false,
        emojis: this.verificationData.emojis,
        fingerprint: this.verificationData.fingerprint,
        securityLevel: 'compromised',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Confirmation failed'
      };
    }
  }
  
  /**
   * Rejects the current SAS verification due to emoji mismatch
   * This indicates a potential MITM attack
   */
  rejectVerification(reason: string = 'Emoji mismatch detected'): SASVerificationResult {
    if (!this.verificationData) {
      return {
        success: false,
        emojis: [],
        fingerprint: '',
        securityLevel: 'compromised',
        timestamp: new Date(),
        error: 'No verification data available'
      };
    }
    
    console.log('[SASVerification] Verification rejected:', reason);
    console.log('[SASVerification] POTENTIAL MITM ATTACK DETECTED');
    
    return {
      success: false,
      emojis: this.verificationData.emojis,
      fingerprint: this.verificationData.fingerprint,
      securityLevel: 'compromised',
      timestamp: new Date(),
      error: reason
    };
  }
  
  /**
   * Gets the current verification status
   */
  getVerificationStatus(): {
    isVerified: boolean;
    data: SASVerificationData | null;
    securityLevel: 'verified' | 'unverified' | 'compromised';
  } {
    return {
      isVerified: this.isVerified,
      data: this.verificationData,
      securityLevel: this.isVerified ? 'verified' : 'unverified'
    };
  }
  
  /**
   * Validates that an emoji sequence is properly formatted
   */
  validateEmojiSequence(emojis: string[]): boolean {
    if (emojis.length !== 5) {
      console.log('[SASVerification] Invalid emoji count:', emojis.length);
      return false;
    }
    
    const isValid = emojis.every(emoji => VERIFICATION_EMOJIS.includes(emoji));
    if (!isValid) {
      console.log('[SASVerification] Invalid emojis detected:', emojis);
    }
    
    return isValid;
  }
  
  /**
   * Compares two emoji sequences to detect potential attacks
   */
  compareEmojiSequences(myEmojis: string[], theirEmojis: string[]): {
    match: boolean;
    confidence: number;
    analysis: string;
  } {
    if (!this.validateEmojiSequence(myEmojis) || !this.validateEmojiSequence(theirEmojis)) {
      return {
        match: false,
        confidence: 0,
        analysis: 'Invalid emoji sequence format'
      };
    }
    
    let matchCount = 0;
    for (let i = 0; i < myEmojis.length; i++) {
      if (myEmojis[i] === theirEmojis[i]) {
        matchCount++;
      }
    }
    
    const confidence = (matchCount / myEmojis.length) * 100;
    const match = matchCount === myEmojis.length;
    
    let analysis: string;
    if (match) {
      analysis = 'Perfect match - connection is secure';
    } else if (confidence > 80) {
      analysis = 'Partial match - possible transmission error';
    } else if (confidence > 20) {
      analysis = 'Poor match - potential security issue';
    } else {
      analysis = 'No match - likely MITM attack detected';
    }
    
    console.log('[SASVerification] Emoji comparison:', {
      myEmojis: myEmojis.join(' '),
      theirEmojis: theirEmojis.join(' '),
      matchCount,
      confidence: confidence.toFixed(1),
      analysis
    });
    
    return { match, confidence, analysis };
  }
  
  /**
   * Detects potential key changes that might indicate attacks
   */
  detectKeyChanges(previousFingerprint: string): {
    changed: boolean;
    risk: 'low' | 'medium' | 'high';
    recommendation: string;
  } {
    if (!this.verificationData) {
      return {
        changed: false,
        risk: 'high',
        recommendation: 'No verification data available - high risk'
      };
    }
    
    const changed = previousFingerprint !== this.verificationData.fingerprint;
    
    if (!changed) {
      return {
        changed: false,
        risk: 'low',
        recommendation: 'Keys unchanged - continue safely'
      };
    }
    
    // Key change detected - this could be legitimate (new session) or attack
    console.log('[SASVerification] Key change detected!');
    console.log('Previous fingerprint:', previousFingerprint);
    console.log('Current fingerprint:', this.verificationData.fingerprint);
    
    return {
      changed: true,
      risk: 'high',
      recommendation: 'Keys changed - re-verify connection immediately'
    };
  }
  
  /**
   * Gets security information about the current SAS system
   */
  getSecurityInfo(): {
    totalCombinations: number;
    collisionProbability: number;
    securityBits: number;
    recommendedAction: string;
  } {
    return {
      totalCombinations: VERIFICATION_SECURITY_INFO.totalCombinations,
      collisionProbability: VERIFICATION_SECURITY_INFO.collisionProbability,
      securityBits: VERIFICATION_SECURITY_INFO.securityBits,
      recommendedAction: this.isVerified 
        ? 'Connection verified - chat securely'
        : 'Verify emoji sequence before sending sensitive information'
    };
  }
  
  /**
   * Clears all verification data (called on session end)
   */
  cleanup(): void {
    console.log('[SASVerification] Cleaning up verification data');
    this.verificationData = null;
    this.isVerified = false;
  }
  
  /**
   * Exports verification data for persistence (if needed)
   */
  exportVerificationData(): string | null {
    if (!this.verificationData) return null;
    
    return Buffer.from(JSON.stringify({
      fingerprint: this.verificationData.fingerprint,
      verified: this.verificationData.verified,
      timestamp: this.verificationData.timestamp.toISOString()
    })).toString('base64');
  }
  
  /**
   * Imports previously exported verification data
   */
  importVerificationData(exportedData: string): boolean {
    try {
      const data = JSON.parse(Buffer.from(exportedData, 'base64').toString());
      
      if (this.verificationData) {
        this.verificationData.verified = data.verified;
        this.verificationData.timestamp = new Date(data.timestamp);
        this.isVerified = data.verified;
        
        // Validate fingerprint matches
        if (this.verificationData.fingerprint === data.fingerprint) {
          console.log('[SASVerification] Verification data imported successfully');
          return true;
        } else {
          console.log('[SASVerification] Fingerprint mismatch on import - security risk');
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[SASVerification] Error importing verification data:', error);
      return false;
    }
  }
}

/**
 * Utility function to create a new SAS verification instance
 */
export function createSASVerification(): SASVerification {
  return new SASVerification();
}

/**
 * Utility function to generate SAS emojis without creating an instance
 * Useful for one-off verification checks
 */
export function generateSASEmojis(
  publicKey1: Uint8Array,
  publicKey2: Uint8Array,
  context: string
): string[] {
  return generateVerificationEmojis(publicKey1, publicKey2, context);
}

/**
 * Security analysis constants and utilities
 */
export const SAS_SECURITY = {
  EMOJI_COUNT: 5,
  TOTAL_EMOJIS: VERIFICATION_EMOJIS.length,
  SECURITY_BITS: VERIFICATION_SECURITY_INFO.securityBits,
  COLLISION_PROBABILITY: VERIFICATION_SECURITY_INFO.collisionProbability,
  RECOMMENDED_MIN_SECURITY_BITS: 20, // Industry standard minimum
  
  /**
   * Calculates the security strength of the SAS system
   */
  getSecurityStrength(): 'weak' | 'moderate' | 'strong' | 'excellent' {
    const bits = VERIFICATION_SECURITY_INFO.securityBits;
    
    if (bits < 20) return 'weak';
    if (bits < 30) return 'moderate';
    if (bits < 40) return 'strong';
    return 'excellent';
  }
};

export default SASVerification;