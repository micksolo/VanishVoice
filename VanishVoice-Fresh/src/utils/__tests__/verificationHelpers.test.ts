import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import {
  generateVerificationEmojis,
  generateKeyFingerprint,
  hasKeyChanged,
  formatVerificationEmojis,
  isValidVerificationSequence,
  VERIFICATION_EMOJIS,
  VERIFICATION_SECURITY_INFO
} from '../verificationHelpers';

// Mock keys for testing
const mockKeyPair1 = nacl.box.keyPair();
const mockKeyPair2 = nacl.box.keyPair();

describe('Verification Helpers', () => {
  describe('generateVerificationEmojis', () => {
    it('should generate 5 emojis from two public keys', () => {
      const emojis = generateVerificationEmojis(mockKeyPair1.publicKey, mockKeyPair2.publicKey);
      
      expect(emojis).toHaveLength(5);
      expect(emojis.every(emoji => VERIFICATION_EMOJIS.includes(emoji))).toBe(true);
    });

    it('should generate same emojis regardless of key order', () => {
      const emojis1 = generateVerificationEmojis(mockKeyPair1.publicKey, mockKeyPair2.publicKey);
      const emojis2 = generateVerificationEmojis(mockKeyPair2.publicKey, mockKeyPair1.publicKey);
      
      expect(emojis1).toEqual(emojis2);
    });

    it('should generate different emojis for different key pairs', () => {
      const mockKeyPair3 = nacl.box.keyPair();
      
      const emojis1 = generateVerificationEmojis(mockKeyPair1.publicKey, mockKeyPair2.publicKey);
      const emojis2 = generateVerificationEmojis(mockKeyPair1.publicKey, mockKeyPair3.publicKey);
      
      expect(emojis1).not.toEqual(emojis2);
    });

    it('should include session info in emoji generation', () => {
      const emojis1 = generateVerificationEmojis(mockKeyPair1.publicKey, mockKeyPair2.publicKey);
      const emojis2 = generateVerificationEmojis(mockKeyPair1.publicKey, mockKeyPair2.publicKey, 'session123');
      
      expect(emojis1).not.toEqual(emojis2);
    });
  });

  describe('generateKeyFingerprint', () => {
    it('should generate consistent fingerprint for same keys', () => {
      const fingerprint1 = generateKeyFingerprint(mockKeyPair1.publicKey, mockKeyPair2.publicKey);
      const fingerprint2 = generateKeyFingerprint(mockKeyPair1.publicKey, mockKeyPair2.publicKey);
      
      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate same fingerprint regardless of key order', () => {
      const fingerprint1 = generateKeyFingerprint(mockKeyPair1.publicKey, mockKeyPair2.publicKey);
      const fingerprint2 = generateKeyFingerprint(mockKeyPair2.publicKey, mockKeyPair1.publicKey);
      
      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should be 32 characters long (hex)', () => {
      const fingerprint = generateKeyFingerprint(mockKeyPair1.publicKey, mockKeyPair2.publicKey);
      
      expect(fingerprint).toHaveLength(32);
      expect(/^[0-9A-F]{32}$/.test(fingerprint)).toBe(true);
    });
  });

  describe('hasKeyChanged', () => {
    it('should return false for identical fingerprints', () => {
      const fingerprint = generateKeyFingerprint(mockKeyPair1.publicKey, mockKeyPair2.publicKey);
      
      expect(hasKeyChanged(fingerprint, fingerprint)).toBe(false);
    });

    it('should return true for different fingerprints', () => {
      const mockKeyPair3 = nacl.box.keyPair();
      const fingerprint1 = generateKeyFingerprint(mockKeyPair1.publicKey, mockKeyPair2.publicKey);
      const fingerprint2 = generateKeyFingerprint(mockKeyPair1.publicKey, mockKeyPair3.publicKey);
      
      expect(hasKeyChanged(fingerprint1, fingerprint2)).toBe(true);
    });
  });

  describe('formatVerificationEmojis', () => {
    it('should join emojis with spaces', () => {
      const emojis = ['🔐', '🔑', '🛡️', '⭐', '🎯'];
      const formatted = formatVerificationEmojis(emojis);
      
      expect(formatted).toBe('🔐 🔑 🛡️ ⭐ 🎯');
    });
  });

  describe('isValidVerificationSequence', () => {
    it('should validate correct emoji sequences', () => {
      const validEmojis = ['🔐', '🔑', '🛡️', '⭐', '🎯'];
      
      expect(isValidVerificationSequence(validEmojis)).toBe(true);
    });

    it('should reject wrong length sequences', () => {
      const shortEmojis = ['🔐', '🔑'];
      const longEmojis = ['🔐', '🔑', '🛡️', '⭐', '🎯', '🚀'];
      
      expect(isValidVerificationSequence(shortEmojis)).toBe(false);
      expect(isValidVerificationSequence(longEmojis)).toBe(false);
    });

    it('should reject invalid emojis', () => {
      const invalidEmojis = ['🔐', '🔑', '🛡️', '⭐', '🤖']; // 🤖 not in list
      
      expect(isValidVerificationSequence(invalidEmojis)).toBe(false);
    });
  });

  describe('VERIFICATION_SECURITY_INFO', () => {
    it('should have correct security parameters', () => {
      expect(VERIFICATION_SECURITY_INFO.emojiCount).toBe(5);
      expect(VERIFICATION_SECURITY_INFO.totalEmojis).toBe(VERIFICATION_EMOJIS.length);
      expect(VERIFICATION_SECURITY_INFO.totalCombinations).toBe(Math.pow(VERIFICATION_EMOJIS.length, 5));
      expect(VERIFICATION_SECURITY_INFO.securityBits).toBeGreaterThan(25); // Should provide good security
    });
  });
});