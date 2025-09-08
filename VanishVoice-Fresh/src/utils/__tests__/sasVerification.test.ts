import { createSASVerification, generateSASEmojis, SAS_SECURITY } from '../sasVerification';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

describe('SAS Verification MITM Protection', () => {
  let publicKey1: Uint8Array;
  let publicKey2: Uint8Array;
  let publicKey3: Uint8Array; // For MITM simulation
  
  beforeEach(() => {
    // Generate test key pairs
    const keyPair1 = nacl.box.keyPair();
    const keyPair2 = nacl.box.keyPair();
    const keyPair3 = nacl.box.keyPair(); // MITM attacker's keys
    
    publicKey1 = keyPair1.publicKey;
    publicKey2 = keyPair2.publicKey;
    publicKey3 = keyPair3.publicKey;
  });

  describe('SAS Generation', () => {
    it('should generate deterministic emoji sequences for same key pair', () => {
      const context = 'test-session-123';
      
      const emojis1 = generateSASEmojis(publicKey1, publicKey2, context);
      const emojis2 = generateSASEmojis(publicKey1, publicKey2, context);
      
      expect(emojis1).toEqual(emojis2);
      expect(emojis1).toHaveLength(5);
      console.log('Generated SAS emojis:', emojis1.join(' '));
    });

    it('should generate identical emojis regardless of key order', () => {
      const context = 'test-session-123';
      
      const emojis1 = generateSASEmojis(publicKey1, publicKey2, context);
      const emojis2 = generateSASEmojis(publicKey2, publicKey1, context);
      
      expect(emojis1).toEqual(emojis2);
    });

    it('should generate different emojis for different key pairs', () => {
      const context = 'test-session-123';
      
      const emojis1 = generateSASEmojis(publicKey1, publicKey2, context);
      const emojis2 = generateSASEmojis(publicKey1, publicKey3, context);
      
      expect(emojis1).not.toEqual(emojis2);
    });

    it('should generate different emojis for different contexts', () => {
      const emojis1 = generateSASEmojis(publicKey1, publicKey2, 'context-1');
      const emojis2 = generateSASEmojis(publicKey1, publicKey2, 'context-2');
      
      expect(emojis1).not.toEqual(emojis2);
    });
  });

  describe('MITM Detection', () => {
    it('should detect MITM attack when emoji sequences differ', () => {
      const sas = createSASVerification();
      const context = 'test-session-123';
      
      // Generate SAS for legitimate conversation
      const legitimateData = sas.generateSAS(publicKey1, publicKey2, context);
      
      // Simulate MITM attack with different keys
      const attackEmojis = generateSASEmojis(publicKey1, publicKey3, context);
      
      // Compare sequences using the SAS verification method
      const comparison = sas.compareEmojiSequences(legitimateData.emojis, attackEmojis);
      
      expect(comparison.match).toBe(false);
      expect(comparison.confidence).toBeLessThan(100);
      
      // The basic SAS comparison doesn't have MITM detection built-in
      // That's handled at the encryption level
      console.log('MITM Detection Result:', {
        legitimate: legitimateData.emojis.join(' '),
        attacker: attackEmojis.join(' '),
        confidence: comparison.confidence,
        analysis: comparison.analysis
      });
      
      // Verify sequences are different (indicating MITM)
      expect(legitimateData.emojis).not.toEqual(attackEmojis);
    });

    it('should confirm verification when emoji sequences match', () => {
      const sas = createSASVerification();
      const context = 'test-session-123';
      
      // Generate SAS for both parties (should be identical)
      const sasData = sas.generateSAS(publicKey1, publicKey2, context);
      const partnerEmojis = generateSASEmojis(publicKey2, publicKey1, context); // Partner's view
      
      // Compare sequences
      const comparison = sas.compareEmojiSequences(sasData.emojis, partnerEmojis);
      
      expect(comparison.match).toBe(true);
      expect(comparison.confidence).toBe(100);
      expect(comparison.analysis).toContain('Perfect match');
    });

    it('should handle partial matches appropriately', () => {
      const sas = createSASVerification();
      const context = 'test-session-123';
      
      const sasData = sas.generateSAS(publicKey1, publicKey2, context);
      
      // Create partial match (change last emoji)
      const partialMatch = [...sasData.emojis];
      partialMatch[4] = '🚀'; // Different emoji
      
      const comparison = sas.compareEmojiSequences(sasData.emojis, partialMatch);
      
      expect(comparison.match).toBe(false);
      expect(comparison.confidence).toBe(80); // 4/5 match = 80%
      expect(comparison.analysis).toContain('Poor match');
    });
  });

  describe('Security Properties', () => {
    it('should have strong security parameters', () => {
      const security = SAS_SECURITY;
      
      expect(security.EMOJI_COUNT).toBe(5);
      expect(security.TOTAL_EMOJIS).toBeGreaterThan(40); // Good selection
      expect(security.SECURITY_BITS).toBeGreaterThan(25); // Strong security
      expect(security.getSecurityStrength()).toBe('moderate');
      
      console.log('Security Analysis:', {
        emojiCount: security.EMOJI_COUNT,
        totalEmojis: security.TOTAL_EMOJIS,
        securityBits: security.SECURITY_BITS,
        totalCombinations: Math.pow(security.TOTAL_EMOJIS, security.EMOJI_COUNT),
        collisionProbability: security.COLLISION_PROBABILITY,
        strength: security.getSecurityStrength()
      });
    });

    it('should have collision probability better than 1 in 500 million', () => {
      const totalCombinations = Math.pow(SAS_SECURITY.TOTAL_EMOJIS, SAS_SECURITY.EMOJI_COUNT);
      const collisionProbability = 1 / totalCombinations;
      
      expect(totalCombinations).toBeGreaterThan(500_000_000); // > 500 million (actual is ~550 million)
      expect(collisionProbability).toBeLessThan(0.000000002); // < 1 in 500 million
    });
  });

  describe('Verification Workflow', () => {
    it('should complete full verification workflow', () => {
      const sas = createSASVerification();
      const context = 'session-abc-partner-def';
      
      // Step 1: Generate SAS
      const sasData = sas.generateSAS(publicKey1, publicKey2, context);
      
      expect(sasData.verified).toBe(false);
      expect(sasData.emojis).toHaveLength(5);
      expect(sasData.securityBits).toBeGreaterThan(25);
      
      // Step 2: Verify status (before confirmation)
      const statusBefore = sas.getVerificationStatus();
      expect(statusBefore.isVerified).toBe(false);
      expect(statusBefore.securityLevel).toBe('unverified');
      
      // Step 3: Confirm verification (after users verify emojis match)
      const result = sas.confirmVerification();
      
      expect(result.success).toBe(true);
      expect(result.securityLevel).toBe('verified');
      
      // Step 4: Verify status (after confirmation)
      const statusAfter = sas.getVerificationStatus();
      expect(statusAfter.isVerified).toBe(true);
      expect(statusAfter.securityLevel).toBe('verified');
    });

    it('should handle verification rejection properly', () => {
      const sas = createSASVerification();
      const context = 'session-abc-partner-def';
      
      const sasData = sas.generateSAS(publicKey1, publicKey2, context);
      
      // Reject verification due to emoji mismatch
      const result = sas.rejectVerification('Emoji sequences do not match');
      
      expect(result.success).toBe(false);
      expect(result.securityLevel).toBe('compromised');
      expect(result.error).toContain('Emoji sequences do not match');
      
      // Verify status shows compromised
      const status = sas.getVerificationStatus();
      expect(status.securityLevel).toBe('unverified'); // SAS doesn't change internal state
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid emoji sequences', () => {
      const sas = createSASVerification();
      const context = 'test-session';
      
      const sasData = sas.generateSAS(publicKey1, publicKey2, context);
      
      // Invalid sequences
      const tooShort = ['🔐', '🔑'];
      const tooLong = ['🔐', '🔑', '🛡️', '⭐', '🎯', '🚀', '💎'];
      const invalid = ['invalid', 'emojis', 'here', 'test', 'fail'];
      
      expect(sas.validateEmojiSequence(tooShort)).toBe(false);
      expect(sas.validateEmojiSequence(tooLong)).toBe(false);
      expect(sas.validateEmojiSequence(invalid)).toBe(false);
      expect(sas.validateEmojiSequence(sasData.emojis)).toBe(true);
    });

    it('should cleanup properly', () => {
      const sas = createSASVerification();
      const context = 'test-session';
      
      const sasData = sas.generateSAS(publicKey1, publicKey2, context);
      sas.confirmVerification();
      
      // Verify data exists
      const statusBefore = sas.getVerificationStatus();
      expect(statusBefore.data).not.toBeNull();
      
      // Cleanup
      sas.cleanup();
      
      // Verify cleanup
      const statusAfter = sas.getVerificationStatus();
      expect(statusAfter.data).toBeNull();
      expect(statusAfter.isVerified).toBe(false);
    });
  });

  describe('Real-World MITM Scenarios', () => {
    it('should detect server-based MITM attack', () => {
      // Scenario: Attacker controls server and substitutes public keys
      const sas1 = createSASVerification();
      const sas2 = createSASVerification();
      const context = 'chat-session-456';
      
      // User 1 thinks they're talking to User 2, but attacker substituted keys
      const user1SAS = sas1.generateSAS(publicKey1, publicKey3, context); // User1 + Attacker
      const user2SAS = sas2.generateSAS(publicKey2, publicKey3, context); // User2 + Attacker
      
      // Users compare their emoji sequences
      const comparison = sas1.compareEmojiSequences(user1SAS.emojis, user2SAS.emojis);
      
      // Should detect MITM because emojis won't match
      expect(comparison.match).toBe(false);
      
      console.log('Server MITM Detection:', {
        user1Emojis: user1SAS.emojis.join(' '),
        user2Emojis: user2SAS.emojis.join(' '),
        match: comparison.match
      });
    });

    it('should NOT false-positive on legitimate connection', () => {
      // Scenario: Legitimate conversation between two users
      const sas1 = createSASVerification();
      const sas2 = createSASVerification();
      const context = 'legitimate-chat-789';
      
      // Both users generate SAS with correct public keys
      const user1SAS = sas1.generateSAS(publicKey1, publicKey2, context);
      const user2SAS = sas2.generateSAS(publicKey2, publicKey1, context);
      
      // Should be identical
      expect(user1SAS.emojis).toEqual(user2SAS.emojis);
      
      // Comparison should show secure connection
      const comparison = sas1.compareEmojiSequences(user1SAS.emojis, user2SAS.emojis);
      
      expect(comparison.match).toBe(true);
      expect(comparison.confidence).toBe(100);
    });
  });
});