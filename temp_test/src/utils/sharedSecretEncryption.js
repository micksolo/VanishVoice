"use strict";
/**
 * Shared Secret Encryption for Friend Messages
 *
 * This module provides symmetric encryption using a shared secret
 * that both friends can derive independently without key exchange.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const Crypto = __importStar(require("expo-crypto"));
const buffer_1 = require("buffer");
class SharedSecretEncryption {
    /**
     * Derive a shared secret for a friendship
     * Both friends will generate the same secret
     */
    static async deriveSharedSecret(userId1, userId2) {
        console.log('[SharedSecretEncryption] Deriving shared secret for:', userId1, userId2);
        // Sort IDs to ensure both friends generate the same secret
        const sortedIds = [userId1, userId2].sort();
        const combinedId = sortedIds.join(':');
        console.log('[SharedSecretEncryption] Combined ID:', combinedId);
        // Generate a deterministic key for this friendship
        const sharedKey = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `vanishvoice:friendship:${combinedId}:shared_key_v2`, { encoding: Crypto.CryptoEncoding.BASE64 });
        console.log('[SharedSecretEncryption] Shared key (first 10 chars):', sharedKey.substring(0, 10));
        return sharedKey;
    }
    /**
     * Encrypt a message using shared secret
     */
    static async encrypt(message, sharedSecret) {
        try {
            // Generate a random nonce
            const nonceBytes = await Crypto.getRandomBytesAsync(16);
            const nonce = buffer_1.Buffer.from(nonceBytes).toString('base64');
            // Create encryption key by combining shared secret and nonce
            const encryptionKey = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sharedSecret + nonce, { encoding: Crypto.CryptoEncoding.HEX });
            // Convert message to buffer
            const messageBuffer = buffer_1.Buffer.from(message, 'utf8');
            const keyBuffer = buffer_1.Buffer.from(encryptionKey, 'hex');
            // Simple XOR encryption with key stretching
            const encrypted = buffer_1.Buffer.alloc(messageBuffer.length);
            for (let i = 0; i < messageBuffer.length; i++) {
                encrypted[i] = messageBuffer[i] ^ keyBuffer[i % keyBuffer.length];
            }
            // Add authentication tag
            const authTag = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, encrypted.toString('base64') + sharedSecret + nonce, { encoding: Crypto.CryptoEncoding.BASE64 });
            // Combine encrypted data and auth tag
            const authTagBuffer = buffer_1.Buffer.from(authTag, 'base64').slice(0, 16);
            const combined = buffer_1.Buffer.concat([authTagBuffer, encrypted]);
            return {
                encrypted: combined.toString('base64'),
                nonce: nonce
            };
        }
        catch (error) {
            console.error('[SharedSecretEncryption] Encryption failed:', error);
            throw error;
        }
    }
    /**
     * Decrypt a message using shared secret
     */
    static async decrypt(encryptedData, nonce, sharedSecret) {
        try {
            // Parse encrypted data
            const combined = buffer_1.Buffer.from(encryptedData, 'base64');
            if (combined.length < 16) {
                throw new Error('Invalid encrypted data - too short');
            }
            // Extract auth tag and encrypted content
            const authTag = combined.slice(0, 16);
            const encrypted = combined.slice(16);
            // Verify authentication tag
            const expectedTag = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, encrypted.toString('base64') + sharedSecret + nonce, { encoding: Crypto.CryptoEncoding.BASE64 });
            const expectedTagBuffer = buffer_1.Buffer.from(expectedTag, 'base64').slice(0, 16);
            if (!authTag.equals(expectedTagBuffer)) {
                throw new Error('Authentication failed - message may have been tampered with');
            }
            // Create decryption key
            const decryptionKey = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sharedSecret + nonce, { encoding: Crypto.CryptoEncoding.HEX });
            const keyBuffer = buffer_1.Buffer.from(decryptionKey, 'hex');
            // XOR decryption
            const decrypted = buffer_1.Buffer.alloc(encrypted.length);
            for (let i = 0; i < encrypted.length; i++) {
                decrypted[i] = encrypted[i] ^ keyBuffer[i % keyBuffer.length];
            }
            return decrypted.toString('utf8');
        }
        catch (error) {
            console.error('[SharedSecretEncryption] Decryption failed:', error);
            throw error;
        }
    }
}
exports.default = SharedSecretEncryption;
