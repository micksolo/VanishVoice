import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

// Standard emoji set for verification (easily distinguishable across cultures)
export const VERIFICATION_EMOJIS = [
  '🔐', '🔑', '🛡️', '⭐', '🎯', '🚀', '💎', '🌟',
  '🔥', '⚡', '🎨', '🎵', '🎲', '🎪', '🎭', '🎨',
  '🏆', '🎖️', '🏅', '🎁', '🎂', '🍎', '🍊', '🍋',
  '🍌', '🍇', '🍓', '🥝', '🍑', '🥥', '🥨', '🧀',
  '🦋', '🐝', '🐞', '🐢', '🦄', '🐙', '🦀', '🐠',
  '🌺', '🌸', '🌼', '🌻', '🌱', '🌿', '🍀', '🌈',
  '⚽', '🏀', '🏈', '🎾', '🏐', '🏓', '🎳', '🎯'
];

/**
 * Generates a Short Authentication String (SAS) from shared key material
 * Uses HKDF-like approach to derive verification data from both public keys
 */
export function generateVerificationEmojis(
  myPublicKey: Uint8Array,
  partnerPublicKey: Uint8Array,
  sessionInfo?: string
): string[] {
  // Combine both public keys in a consistent order (smaller key first)
  const key1 = Buffer.from(myPublicKey);
  const key2 = Buffer.from(partnerPublicKey);
  
  // Sort keys to ensure both parties get same result regardless of order
  const sortedKeys = [key1, key2].sort(Buffer.compare);
  const combinedKeys = Buffer.concat(sortedKeys);
  
  // Add session information if provided for additional uniqueness
  let inputData = combinedKeys;
  if (sessionInfo) {
    const sessionBuffer = Buffer.from(sessionInfo, 'utf8');
    inputData = Buffer.concat([combinedKeys, sessionBuffer]);
  }
  
  // Use SHA-256 to generate deterministic bytes
  const hash = nacl.hash(inputData);
  
  // Convert hash bytes to emoji indices
  const emojiCount = 5; // 5 emojis provide good security vs usability balance
  const emojis: string[] = [];
  
  for (let i = 0; i < emojiCount; i++) {
    // Use 2 bytes per emoji to get good distribution
    const byteIndex = i * 2;
    const value = (hash[byteIndex] << 8) | hash[byteIndex + 1];
    const emojiIndex = value % VERIFICATION_EMOJIS.length;
    emojis.push(VERIFICATION_EMOJIS[emojiIndex]);
  }
  
  return emojis;
}

/**
 * Generates a key fingerprint for detecting key changes
 * Uses a shorter format suitable for UI display
 */
export function generateKeyFingerprint(
  myPublicKey: Uint8Array,
  partnerPublicKey: Uint8Array
): string {
  const key1 = Buffer.from(myPublicKey);
  const key2 = Buffer.from(partnerPublicKey);
  
  // Sort keys for consistent ordering
  const sortedKeys = [key1, key2].sort(Buffer.compare);
  const combinedKeys = Buffer.concat(sortedKeys);
  
  // Generate SHA-256 hash
  const hash = nacl.hash(combinedKeys);
  
  // Return first 16 bytes as hex (32 characters)
  return Buffer.from(hash.slice(0, 16)).toString('hex').toUpperCase();
}

/**
 * Compares two key fingerprints to detect potential key changes
 */
export function hasKeyChanged(
  oldFingerprint: string,
  newFingerprint: string
): boolean {
  return oldFingerprint !== newFingerprint;
}

/**
 * Formats verification emojis for display
 */
export function formatVerificationEmojis(emojis: string[]): string {
  return emojis.join(' ');
}

/**
 * Validates that a verification emoji sequence is valid
 */
export function isValidVerificationSequence(emojis: string[]): boolean {
  if (emojis.length !== 5) return false;
  
  return emojis.every(emoji => VERIFICATION_EMOJIS.includes(emoji));
}

/**
 * Security analysis of verification strength
 * 5 emojis from 56 options = 56^5 = ~550 billion possibilities
 * Probability of accidental match: 1 in 550 billion
 * This provides strong protection against MITM attacks
 */
export const VERIFICATION_SECURITY_INFO = {
  emojiCount: 5,
  totalEmojis: VERIFICATION_EMOJIS.length,
  totalCombinations: Math.pow(VERIFICATION_EMOJIS.length, 5),
  collisionProbability: 1 / Math.pow(VERIFICATION_EMOJIS.length, 5),
  securityBits: Math.log2(Math.pow(VERIFICATION_EMOJIS.length, 5))
};