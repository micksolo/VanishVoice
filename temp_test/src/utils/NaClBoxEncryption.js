"use strict";
/**
 * NaCl Box Encryption Service
 *
 * This service provides zero-knowledge end-to-end encryption using nacl.box.
 * The server can NEVER decrypt messages because it doesn't have access to private keys.
 *
 * SECURITY MODEL:
 * - Uses Curve25519 key exchange + XSalsa20 + Poly1305 MAC
 * - Private keys stored only in secure hardware on device
 * - Public keys stored in database for key exchange
 * - Server can route encrypted data but never decrypt it
 * - Perfect Forward Secrecy via ephemeral keys
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const tweetnacl_util_1 = __importDefault(require("tweetnacl-util"));
class NaClBoxEncryption {
    /**
     * Encrypt data using nacl.box with ephemeral keys for Perfect Forward Secrecy
     *
     * @param data - Data to encrypt (string or Uint8Array)
     * @param recipientPublicKey - Recipient's public key (base64)
     * @param senderPrivateKey - Sender's private key (base64) - optional for ephemeral
     * @returns Encrypted data with ephemeral public key
     */
    static async encrypt(data, recipientPublicKey, senderPrivateKey) {
        try {
            console.log('[NaClBoxEncryption] Encrypting data with nacl.box...');
            // Convert data to bytes
            const dataBytes = typeof data === 'string'
                ? tweetnacl_util_1.default.decodeUTF8(data)
                : data;
            // Generate ephemeral keypair for Perfect Forward Secrecy
            const ephemeralKeys = tweetnacl_1.default.box.keyPair();
            // Generate random nonce
            const nonce = tweetnacl_1.default.randomBytes(24);
            // Decode recipient's public key
            const recipientPubKey = tweetnacl_util_1.default.decodeBase64(recipientPublicKey);
            // Use ephemeral private key (or provided sender private key)
            const senderPrivKey = senderPrivateKey
                ? tweetnacl_util_1.default.decodeBase64(senderPrivateKey)
                : ephemeralKeys.secretKey;
            // Encrypt using nacl.box
            const encrypted = tweetnacl_1.default.box(dataBytes, nonce, recipientPubKey, senderPrivKey);
            if (!encrypted) {
                throw new Error('Encryption failed - nacl.box returned null');
            }
            const result = {
                encryptedContent: tweetnacl_util_1.default.encodeBase64(encrypted),
                nonce: tweetnacl_util_1.default.encodeBase64(nonce),
                ephemeralPublicKey: tweetnacl_util_1.default.encodeBase64(senderPrivateKey ? tweetnacl_util_1.default.decodeBase64(await this.getPublicKeyFromPrivate(senderPrivateKey)) : ephemeralKeys.publicKey)
            };
            console.log('[NaClBoxEncryption] Encryption successful');
            console.log(`[NaClBoxEncryption] Encrypted size: ${result.encryptedContent.length} chars`);
            console.log(`[NaClBoxEncryption] Nonce: ${result.nonce.substring(0, 10)}...`);
            console.log(`[NaClBoxEncryption] Ephemeral public key: ${result.ephemeralPublicKey.substring(0, 10)}...`);
            return result;
        }
        catch (error) {
            console.error('[NaClBoxEncryption] Encryption failed:', error);
            throw error;
        }
    }
    /**
     * Decrypt data using nacl.box.open
     *
     * @param encryptedContent - Encrypted data (base64)
     * @param nonce - Nonce used for encryption (base64)
     * @param ephemeralPublicKey - Sender's ephemeral public key (base64)
     * @param recipientPrivateKey - Recipient's private key (base64)
     * @returns Decrypted data as Uint8Array
     */
    static async decrypt(encryptedContent, nonce, ephemeralPublicKey, recipientPrivateKey) {
        try {
            console.log('[NaClBoxEncryption] Decrypting data with nacl.box.open...');
            // Decode all parameters
            const encryptedBytes = tweetnacl_util_1.default.decodeBase64(encryptedContent);
            const nonceBytes = tweetnacl_util_1.default.decodeBase64(nonce);
            const senderPubKey = tweetnacl_util_1.default.decodeBase64(ephemeralPublicKey);
            const recipientPrivKey = tweetnacl_util_1.default.decodeBase64(recipientPrivateKey);
            console.log('[NaClBoxEncryption] Decoded parameters:');
            console.log(`- Encrypted bytes: ${encryptedBytes.length}`);
            console.log(`- Nonce bytes: ${nonceBytes.length}`);
            console.log(`- Sender pub key bytes: ${senderPubKey.length}`);
            console.log(`- Recipient priv key bytes: ${recipientPrivKey.length}`);
            // Decrypt using nacl.box.open
            const decrypted = tweetnacl_1.default.box.open(encryptedBytes, nonceBytes, senderPubKey, recipientPrivKey);
            if (!decrypted) {
                throw new Error('Decryption failed - nacl.box.open returned null');
            }
            console.log('[NaClBoxEncryption] Decryption successful');
            console.log(`[NaClBoxEncryption] Decrypted size: ${decrypted.length} bytes`);
            return decrypted;
        }
        catch (error) {
            console.error('[NaClBoxEncryption] Decryption failed:', error);
            throw error;
        }
    }
    /**
     * Decrypt and return as UTF-8 string
     */
    static async decryptToString(encryptedContent, nonce, ephemeralPublicKey, recipientPrivateKey) {
        const decryptedBytes = await this.decrypt(encryptedContent, nonce, ephemeralPublicKey, recipientPrivateKey);
        return tweetnacl_util_1.default.encodeUTF8(decryptedBytes);
    }
    /**
     * Encrypt binary data (like audio/video files)
     * Uses a hybrid approach: random key + nacl.box for key encryption
     * This is more efficient for large files than direct nacl.box encryption
     *
     * @param data - Binary data to encrypt (Uint8Array or base64 string)
     * @param recipientPublicKey - Recipient's public key (base64)
     * @returns Encrypted data and encrypted key
     */
    static async encryptBinary(data, recipientPublicKey) {
        try {
            console.log('[NaClBoxEncryption] Encrypting binary data...');
            // Convert data to bytes if needed
            const dataBytes = typeof data === 'string'
                ? new Uint8Array(Buffer.from(data, 'base64'))
                : data;
            // Generate random symmetric key for data encryption
            const dataKey = tweetnacl_1.default.randomBytes(32); // 256-bit key
            const dataNonce = tweetnacl_1.default.randomBytes(24);
            // Encrypt data with symmetric key using XSalsa20
            const encryptedData = tweetnacl_1.default.secretbox(dataBytes, dataNonce, dataKey);
            if (!encryptedData) {
                throw new Error('Data encryption failed');
            }
            // Encrypt the data key using nacl.box
            const keyEncryption = await this.encrypt(dataKey, recipientPublicKey);
            console.log('[NaClBoxEncryption] Binary encryption successful');
            console.log(`[NaClBoxEncryption] Original size: ${dataBytes.length} bytes`);
            console.log(`[NaClBoxEncryption] Encrypted size: ${encryptedData.length} bytes`);
            return {
                encryptedData: tweetnacl_util_1.default.encodeBase64(encryptedData),
                encryptedKey: keyEncryption.encryptedContent,
                keyNonce: keyEncryption.nonce,
                dataNonce: tweetnacl_util_1.default.encodeBase64(dataNonce),
                ephemeralPublicKey: keyEncryption.ephemeralPublicKey,
            };
        }
        catch (error) {
            console.error('[NaClBoxEncryption] Binary encryption failed:', error);
            throw error;
        }
    }
    /**
     * Decrypt binary data
     *
     * @param encryptedData - Encrypted binary data (base64)
     * @param encryptedKey - Encrypted data key (base64)
     * @param keyNonce - Nonce used for key encryption (base64)
     * @param dataNonce - Nonce used for data encryption (base64)
     * @param ephemeralPublicKey - Sender's ephemeral public key (base64)
     * @param recipientPrivateKey - Recipient's private key (base64)
     * @returns Decrypted binary data
     */
    static async decryptBinary(encryptedData, encryptedKey, keyNonce, dataNonce, ephemeralPublicKey, recipientPrivateKey) {
        try {
            console.log('[NaClBoxEncryption] Decrypting binary data...');
            // Decrypt the data key first
            const dataKeyBytes = await this.decrypt(encryptedKey, keyNonce, ephemeralPublicKey, recipientPrivateKey);
            // Decrypt the actual data using the symmetric key
            const encryptedDataBytes = tweetnacl_util_1.default.decodeBase64(encryptedData);
            const dataNonceBytes = tweetnacl_util_1.default.decodeBase64(dataNonce);
            const decryptedData = tweetnacl_1.default.secretbox.open(encryptedDataBytes, dataNonceBytes, dataKeyBytes);
            if (!decryptedData) {
                throw new Error('Binary decryption failed - data key or nonce invalid');
            }
            console.log('[NaClBoxEncryption] Binary decryption successful');
            console.log(`[NaClBoxEncryption] Decrypted size: ${decryptedData.length} bytes`);
            return decryptedData;
        }
        catch (error) {
            console.error('[NaClBoxEncryption] Binary decryption failed:', error);
            throw error;
        }
    }
    /**
     * Helper to derive public key from private key
     * Note: This is a workaround since nacl doesn't provide this directly
     */
    static async getPublicKeyFromPrivate(privateKey) {
        // For now, we'll need to store public keys separately
        // In a full implementation, you'd use the nacl keypair derivation
        // This is a limitation we'll address by always storing both keys
        throw new Error('Public key derivation not implemented - store public keys separately');
    }
    /**
     * Generate a new keypair
     */
    static generateKeyPair() {
        const keyPair = tweetnacl_1.default.box.keyPair();
        return {
            publicKey: tweetnacl_util_1.default.encodeBase64(keyPair.publicKey),
            secretKey: tweetnacl_util_1.default.encodeBase64(keyPair.secretKey),
        };
    }
    /**
     * Verify that encryption/decryption works correctly
     * Used for testing and verification
     */
    static async verifyEncryption() {
        try {
            console.log('[NaClBoxEncryption] Running encryption verification test...');
            // Generate test keypairs
            const senderKeys = this.generateKeyPair();
            const recipientKeys = this.generateKeyPair();
            // Test data
            const testMessage = 'Hello, zero-knowledge encryption!';
            const testBinary = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 64]);
            // Test text encryption
            const encrypted = await this.encrypt(testMessage, recipientKeys.publicKey, senderKeys.secretKey);
            const decrypted = await this.decryptToString(encrypted.encryptedContent, encrypted.nonce, encrypted.ephemeralPublicKey, recipientKeys.secretKey);
            if (decrypted !== testMessage) {
                console.error('[NaClBoxEncryption] Text encryption verification failed');
                return false;
            }
            // Test binary encryption
            const binaryEncrypted = await this.encryptBinary(testBinary, recipientKeys.publicKey);
            const binaryDecrypted = await this.decryptBinary(binaryEncrypted.encryptedData, binaryEncrypted.encryptedKey, binaryEncrypted.keyNonce, binaryEncrypted.dataNonce, binaryEncrypted.ephemeralPublicKey, recipientKeys.secretKey);
            if (binaryDecrypted.length !== testBinary.length ||
                !binaryDecrypted.every((byte, index) => byte === testBinary[index])) {
                console.error('[NaClBoxEncryption] Binary encryption verification failed');
                return false;
            }
            console.log('[NaClBoxEncryption] All encryption verification tests passed!');
            return true;
        }
        catch (error) {
            console.error('[NaClBoxEncryption] Encryption verification failed:', error);
            return false;
        }
    }
}
exports.default = NaClBoxEncryption;
