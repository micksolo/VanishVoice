import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  generateVerificationEmojis, 
  generateKeyFingerprint,
  hasKeyChanged 
} from './verificationHelpers';
import { createSASVerification, SASVerification } from './sasVerification';

interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

interface Session {
  sessionId: string;
  publicKey: string;
  privateKey: string;
}

interface VerificationData {
  emojis: string[];
  fingerprint: string;
  verified: boolean;
  timestamp: Date;
}

class AnonymousEncryption {
  private mySession: Session | null = null;
  private partnerPublicKey: Uint8Array | null = null;
  private sharedSecret: Uint8Array | null = null;
  private conversationId: string | null = null;
  private verificationData: VerificationData | null = null;
  private storedFingerprint: string | null = null;
  private sasVerification: SASVerification | null = null;

  async initialize(mySession: Session, partnerId: string) {
    this.mySession = mySession;
    
    // Initialize SAS verification system
    this.sasVerification = createSASVerification();
    
    // Exchange keys through database
    await this.exchangeKeys(partnerId);
    
    // Derive shared secret
    this.deriveSharedSecret();
    
    // Generate verification data after successful key exchange
    this.generateVerificationData(partnerId);
    
    // Generate SAS verification data for MITM protection
    await this.generateSASVerificationData(partnerId);
  }

  private async exchangeKeys(partnerId: string) {
    if (!this.mySession) throw new Error('Session not initialized');

    try {
      console.log('[AnonymousEncryption] Starting key exchange...');
      console.log('My session:', this.mySession.sessionId);
      console.log('Partner ID:', partnerId);

      // Share our public key
      const { error: insertError } = await supabase
        .from('key_exchange')
        .upsert({
          session_id: this.mySession.sessionId,
          public_key: this.mySession.publicKey,
          for_partner: partnerId,
        });

      if (insertError) {
        console.error('Error inserting key:', insertError);
        throw insertError;
      }

      console.log('[AnonymousEncryption] Our key shared successfully');

      // Wait for partner's key (with timeout)
      let attempts = 0;
      const maxAttempts = 20; // 10 seconds

      while (attempts < maxAttempts) {
        const { data, error: selectError } = await supabase
          .from('key_exchange')
          .select('public_key')
          .eq('session_id', partnerId)
          .eq('for_partner', this.mySession.sessionId)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          console.error('Error fetching partner key:', selectError);
        }

        if (data?.public_key) {
          console.log('[AnonymousEncryption] Partner key received!');
          this.partnerPublicKey = Buffer.from(data.public_key, 'base64');
          return;
        }

        // Wait 500ms before retry
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        
        if (attempts % 4 === 0) {
          console.log(`[AnonymousEncryption] Still waiting for partner key... (${attempts}/20)`);
        }
      }

      throw new Error('Key exchange timeout');
    } catch (error) {
      console.error('Key exchange error:', error);
      throw error;
    }
  }

  private deriveSharedSecret() {
    if (!this.mySession || !this.partnerPublicKey) {
      throw new Error('Keys not available for shared secret');
    }

    const mySecretKey = Buffer.from(this.mySession.privateKey, 'base64');
    
    // Use NaCl box.before to compute shared secret
    this.sharedSecret = nacl.box.before(this.partnerPublicKey, mySecretKey);
  }

  async encryptMessage(plaintext: string): Promise<{ ciphertext: string; nonce: string }> {
    if (!this.sharedSecret) {
      throw new Error('Shared secret not established');
    }

    // Generate random nonce
    const nonce = nacl.randomBytes(24);
    
    // Convert message to bytes
    const messageBytes = Buffer.from(plaintext, 'utf8');
    
    // Encrypt using shared secret
    const encrypted = nacl.box.after(messageBytes, nonce, this.sharedSecret);
    
    return {
      ciphertext: Buffer.from(encrypted).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  async decryptMessage(ciphertext: string, nonceStr: string): Promise<string> {
    if (!this.sharedSecret) {
      throw new Error('Shared secret not established');
    }

    try {
      const encrypted = Buffer.from(ciphertext, 'base64');
      const nonce = Buffer.from(nonceStr, 'base64');
      
      // Decrypt using shared secret
      const decrypted = nacl.box.open.after(encrypted, nonce, this.sharedSecret);
      
      if (!decrypted) {
        throw new Error('Decryption failed');
      }
      
      return Buffer.from(decrypted).toString('utf8');
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  // For file encryption (voice/video)
  async encryptFile(data: Uint8Array): Promise<{ ciphertext: Uint8Array; nonce: string }> {
    if (!this.sharedSecret) {
      throw new Error('Shared secret not established');
    }

    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box.after(data, nonce, this.sharedSecret);
    
    return {
      ciphertext: encrypted,
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  async decryptFile(ciphertext: Uint8Array, nonceStr: string): Promise<Uint8Array> {
    if (!this.sharedSecret) {
      throw new Error('Shared secret not established');
    }

    const nonce = Buffer.from(nonceStr, 'base64');
    const decrypted = nacl.box.open.after(ciphertext, nonce, this.sharedSecret);
    
    if (!decrypted) {
      throw new Error('File decryption failed');
    }
    
    return decrypted;
  }

  // Verification methods for MITM protection
  private generateVerificationData(partnerId: string) {
    if (!this.mySession || !this.partnerPublicKey) {
      throw new Error('Keys not available for verification generation');
    }

    const myPublicKey = Buffer.from(this.mySession.publicKey, 'base64');
    
    // Generate verification emojis using both public keys + session info
    const emojis = generateVerificationEmojis(
      myPublicKey,
      this.partnerPublicKey,
      `${this.mySession.sessionId}-${partnerId}` // Session context for uniqueness
    );
    
    // Generate key fingerprint for key change detection
    const fingerprint = generateKeyFingerprint(myPublicKey, this.partnerPublicKey);
    
    this.verificationData = {
      emojis,
      fingerprint,
      verified: false, // Starts unverified
      timestamp: new Date()
    };
    
    console.log('[AnonymousEncryption] Generated verification emojis:', emojis.join(' '));
    console.log('[AnonymousEncryption] Key fingerprint:', fingerprint);
  }

  // SAS (Short Authentication String) verification for MITM protection
  private async generateSASVerificationData(partnerId: string) {
    if (!this.mySession || !this.partnerPublicKey || !this.sasVerification) {
      console.error('[AnonymousEncryption] Cannot generate SAS - missing requirements');
      return;
    }

    try {
      const myPublicKey = Buffer.from(this.mySession.publicKey, 'base64');
      const sessionContext = `${this.mySession.sessionId}-${partnerId}`;
      
      // Generate SAS verification data
      const sasData = this.sasVerification.generateSAS(
        myPublicKey,
        this.partnerPublicKey,
        sessionContext
      );
      
      console.log('[AnonymousEncryption] SAS verification data generated');
      console.log('SAS emojis:', sasData.emojis.join(' '));
      console.log('Security bits:', sasData.securityBits);
      
      // Update existing verification data with SAS info
      if (this.verificationData) {
        // Ensure SAS and legacy verification emojis match
        if (JSON.stringify(this.verificationData.emojis) === JSON.stringify(sasData.emojis)) {
          console.log('[AnonymousEncryption] SAS verification matches legacy verification - good!');
        } else {
          console.warn('[AnonymousEncryption] SAS verification differs from legacy - using SAS');
          this.verificationData.emojis = sasData.emojis;
        }
      }
    } catch (error) {
      console.error('[AnonymousEncryption] Error generating SAS verification:', error);
      throw error;
    }
  }

  getVerificationData(): VerificationData | null {
    return this.verificationData;
  }

  markAsVerified() {
    if (this.verificationData) {
      this.verificationData.verified = true;
      this.verificationData.timestamp = new Date();
      
      // Store fingerprint for future key change detection
      this.storedFingerprint = this.verificationData.fingerprint;
      
      // Confirm SAS verification
      if (this.sasVerification) {
        const result = this.sasVerification.confirmVerification();
        if (result.success) {
          console.log('[AnonymousEncryption] SAS verification confirmed successfully');
          console.log('Security level:', result.securityLevel);
        } else {
          console.error('[AnonymousEncryption] SAS verification confirmation failed:', result.error);
        }
      }
      
      console.log('[AnonymousEncryption] Connection marked as verified');
    }
  }

  isVerified(): boolean {
    return this.verificationData?.verified ?? false;
  }

  checkForKeyChanges(): boolean {
    if (!this.storedFingerprint || !this.verificationData) {
      return false;
    }
    
    return hasKeyChanged(this.storedFingerprint, this.verificationData.fingerprint);
  }

  getSecurityStatus(): {
    isVerified: boolean;
    hasKeyChanged: boolean;
    fingerprint: string | null;
    verificationEmojis: string[] | null;
    sasSecurityLevel: 'verified' | 'unverified' | 'compromised';
    sasSecurityBits: number;
    mitm: {
      protected: boolean;
      riskLevel: 'low' | 'medium' | 'high';
      recommendation: string;
    };
  } {
    const sasStatus = this.sasVerification?.getVerificationStatus();
    const sasSecurityInfo = this.sasVerification?.getSecurityInfo();
    
    return {
      isVerified: this.isVerified(),
      hasKeyChanged: this.checkForKeyChanges(),
      fingerprint: this.verificationData?.fingerprint ?? null,
      verificationEmojis: this.verificationData?.emojis ?? null,
      sasSecurityLevel: sasStatus?.securityLevel ?? 'unverified',
      sasSecurityBits: sasSecurityInfo?.securityBits ?? 0,
      mitm: {
        protected: sasStatus?.isVerified ?? false,
        riskLevel: sasStatus?.isVerified ? 'low' : 'high',
        recommendation: sasSecurityInfo?.recommendedAction ?? 'Verify connection before sharing sensitive information'
      }
    };
  }

  // MITM Protection Methods
  
  /**
   * Rejects verification due to emoji mismatch - indicates potential MITM attack
   */
  rejectVerification(reason: string = 'Emoji sequences do not match'): boolean {
    if (!this.sasVerification) {
      console.error('[AnonymousEncryption] Cannot reject verification - SAS not initialized');
      return false;
    }
    
    console.log('[AnonymousEncryption] SECURITY ALERT - Verification rejected:', reason);
    
    const result = this.sasVerification.rejectVerification(reason);
    
    if (result.securityLevel === 'compromised') {
      console.error('[AnonymousEncryption] POTENTIAL MITM ATTACK DETECTED!');
      console.error('Rejection reason:', reason);
      console.error('Expected emojis:', this.verificationData?.emojis?.join(' '));
      
      // Mark connection as compromised
      if (this.verificationData) {
        this.verificationData.verified = false;
        this.verificationData.timestamp = new Date();
      }
      
      return true; // MITM attack detected
    }
    
    return false;
  }

  /**
   * Compares emoji sequences between two users to detect MITM
   */
  compareEmojiSequences(theirEmojis: string[]): {
    match: boolean;
    confidence: number;
    analysis: string;
    mitm: {
      detected: boolean;
      riskLevel: 'low' | 'medium' | 'high';
      action: 'continue' | 'reverify' | 'abort';
    };
  } {
    const myEmojis = this.verificationData?.emojis || [];
    
    if (!this.sasVerification) {
      return {
        match: false,
        confidence: 0,
        analysis: 'SAS verification not initialized',
        mitm: { detected: true, riskLevel: 'high', action: 'abort' }
      };
    }
    
    const comparison = this.sasVerification.compareEmojiSequences(myEmojis, theirEmojis);
    
    let mitm: { detected: boolean; riskLevel: 'low' | 'medium' | 'high'; action: 'continue' | 'reverify' | 'abort' };
    
    if (comparison.match) {
      mitm = { detected: false, riskLevel: 'low', action: 'continue' };
    } else if (comparison.confidence > 80) {
      mitm = { detected: false, riskLevel: 'medium', action: 'reverify' };
    } else if (comparison.confidence > 20) {
      mitm = { detected: true, riskLevel: 'high', action: 'reverify' };
    } else {
      mitm = { detected: true, riskLevel: 'high', action: 'abort' };
    }
    
    if (mitm.detected) {
      console.log('[AnonymousEncryption] MITM detection result:', {
        match: comparison.match,
        confidence: comparison.confidence,
        riskLevel: mitm.riskLevel,
        recommendation: mitm.action
      });
    }
    
    return {
      match: comparison.match,
      confidence: comparison.confidence,
      analysis: comparison.analysis,
      mitm
    };
  }

  /**
   * Gets detailed security analysis for debugging and logging
   */
  getDetailedSecurityAnalysis(): {
    keyExchange: {
      completed: boolean;
      myPublicKey: string | null;
      partnerPublicKey: string | null;
      sharedSecretEstablished: boolean;
    };
    verification: {
      emojisGenerated: boolean;
      emojis: string[];
      verified: boolean;
      timestamp: Date | null;
      fingerprint: string | null;
    };
    sas: {
      initialized: boolean;
      securityBits: number;
      totalCombinations: number;
      collisionProbability: number;
      verificationStatus: 'verified' | 'unverified' | 'compromised';
    };
    threats: {
      mitm: {
        protected: boolean;
        lastCheck: Date | null;
      };
      keyChange: {
        detected: boolean;
        storedFingerprint: string | null;
        currentFingerprint: string | null;
      };
    };
  } {
    const sasStatus = this.sasVerification?.getVerificationStatus();
    const sasSecurityInfo = this.sasVerification?.getSecurityInfo();
    
    return {
      keyExchange: {
        completed: !!(this.mySession && this.partnerPublicKey),
        myPublicKey: this.mySession?.publicKey || null,
        partnerPublicKey: this.partnerPublicKey ? Buffer.from(this.partnerPublicKey).toString('base64') : null,
        sharedSecretEstablished: !!this.sharedSecret
      },
      verification: {
        emojisGenerated: !!(this.verificationData?.emojis?.length),
        emojis: this.verificationData?.emojis || [],
        verified: this.verificationData?.verified || false,
        timestamp: this.verificationData?.timestamp || null,
        fingerprint: this.verificationData?.fingerprint || null
      },
      sas: {
        initialized: !!this.sasVerification,
        securityBits: sasSecurityInfo?.securityBits || 0,
        totalCombinations: sasSecurityInfo?.totalCombinations || 0,
        collisionProbability: sasSecurityInfo?.collisionProbability || 1,
        verificationStatus: sasStatus?.securityLevel || 'unverified'
      },
      threats: {
        mitm: {
          protected: sasStatus?.isVerified || false,
          lastCheck: sasStatus?.data?.timestamp || null
        },
        keyChange: {
          detected: this.checkForKeyChanges(),
          storedFingerprint: this.storedFingerprint,
          currentFingerprint: this.verificationData?.fingerprint || null
        }
      }
    };
  }

  // Clean up keys after conversation
  async cleanup() {
    if (this.mySession?.sessionId) {
      // Remove from key exchange
      await supabase
        .from('key_exchange')
        .delete()
        .eq('session_id', this.mySession.sessionId);
    }

    // Cleanup SAS verification
    if (this.sasVerification) {
      this.sasVerification.cleanup();
    }

    // Clear local data
    this.mySession = null;
    this.partnerPublicKey = null;
    this.sharedSecret = null;
    this.verificationData = null;
    this.storedFingerprint = null;
    this.sasVerification = null;
  }
}

export default AnonymousEncryption;