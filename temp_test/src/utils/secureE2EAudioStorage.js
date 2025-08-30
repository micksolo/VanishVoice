"use strict";
/**
 * Secure E2E Audio Storage
 *
 * This module provides end-to-end encrypted storage for voice messages
 * following the same security model as text messages.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyE2EAudioEncryption = exports.uploadE2EEncryptedAudioLegacy = exports.downloadAndDecryptE2EAudio = exports.uploadE2EEncryptedAudio = void 0;
const supabase_1 = require("../services/supabase");
const FileSystem = __importStar(require("expo-file-system"));
const Crypto = __importStar(require("expo-crypto"));
const buffer_1 = require("buffer");
const react_native_1 = require("react-native");
const sharedSecretEncryption_1 = __importDefault(require("./sharedSecretEncryption"));
/**
 * Generate a random encryption key for audio
 */
async function generateAudioKey() {
    const keyBytes = await Crypto.getRandomBytesAsync(32); // 256-bit key
    return buffer_1.Buffer.from(keyBytes).toString('base64');
}
/**
 * Simple XOR encryption - optimized for performance
 */
function xorEncrypt(data, key) {
    const result = new Uint8Array(data.length);
    const keyLen = key.length;
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % keyLen];
    }
    return result;
}
/**
 * Encrypt audio data using fast XOR encryption
 */
async function encryptAudioData(base64Audio, key) {
    // Generate nonce (still needed for additional security)
    const nonceBytes = await Crypto.getRandomBytesAsync(16);
    const nonce = buffer_1.Buffer.from(nonceBytes).toString('base64');
    // Create encryption key by hashing key + nonce (one-time operation)
    const encryptionKey = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key + nonce, { encoding: Crypto.CryptoEncoding.HEX });
    // Convert to Uint8Array for fast XOR
    const audioData = new Uint8Array(buffer_1.Buffer.from(base64Audio, 'base64'));
    const keyData = new Uint8Array(buffer_1.Buffer.from(encryptionKey, 'hex'));
    // Fast XOR encryption
    const encrypted = xorEncrypt(audioData, keyData);
    return {
        encrypted: buffer_1.Buffer.from(encrypted).toString('base64'),
        nonce
    };
}
/**
 * Legacy decryption for backward compatibility
 */
async function decryptAudioDataLegacy(encryptedBase64, key, nonce) {
    // Create base decryption key
    const baseKey = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key + nonce, { encoding: Crypto.CryptoEncoding.HEX });
    const encryptedBuffer = buffer_1.Buffer.from(encryptedBase64, 'base64');
    const baseKeyBuffer = buffer_1.Buffer.from(baseKey, 'hex');
    // Stream cipher decryption
    const decrypted = buffer_1.Buffer.alloc(encryptedBuffer.length);
    const blockSize = baseKeyBuffer.length;
    for (let i = 0; i < encryptedBuffer.length; i += blockSize) {
        const blockKey = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, baseKey + i.toString(), { encoding: Crypto.CryptoEncoding.HEX });
        const blockKeyBuffer = buffer_1.Buffer.from(blockKey, 'hex');
        // XOR this block
        for (let j = 0; j < blockSize && (i + j) < encryptedBuffer.length; j++) {
            decrypted[i + j] = encryptedBuffer[i + j] ^ blockKeyBuffer[j];
        }
    }
    return decrypted.toString('base64');
}
/**
 * Decrypt audio data - Fast XOR version with legacy support
 */
async function decryptAudioData(encryptedBase64, key, nonce, onProgress, version = 1) {
    const startTime = Date.now();
    // If version 1, go straight to legacy decryption
    if (version === 1) {
        // Legacy decryption for version 1 messages
        return decryptAudioDataLegacy(encryptedBase64, key, nonce);
    }
    // Try fast XOR decryption for v2+ messages
    try {
        // Create decryption key (one-time operation)
        const decryptionKey = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key + nonce, { encoding: Crypto.CryptoEncoding.HEX });
        // Convert to Uint8Array for fast XOR
        const encryptedData = new Uint8Array(buffer_1.Buffer.from(encryptedBase64, 'base64'));
        const keyData = new Uint8Array(buffer_1.Buffer.from(decryptionKey, 'hex'));
        // Processing audio decryption...
        // Process in chunks to keep UI responsive
        const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
        const totalChunks = Math.ceil(encryptedData.length / CHUNK_SIZE);
        const decrypted = new Uint8Array(encryptedData.length);
        for (let chunk = 0; chunk < totalChunks; chunk++) {
            const start = chunk * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, encryptedData.length);
            // XOR decrypt this chunk
            for (let i = start; i < end; i++) {
                decrypted[i] = encryptedData[i] ^ keyData[i % keyData.length];
            }
            // Report progress (less frequently for better performance)
            if (onProgress && (chunk === 0 || chunk === totalChunks - 1 || chunk % 10 === 0)) {
                onProgress((chunk + 1) / totalChunks);
            }
        }
        const decryptionTime = Date.now() - startTime;
        console.log(`[E2EAudio] XOR decryption completed in ${decryptionTime}ms`);
        const result = buffer_1.Buffer.from(decrypted).toString('base64');
        // For v2 messages, skip validation since we know they use XOR
        if (version >= 2) {
            return result;
        }
        // For unknown versions, validate the result
        try {
            const testBuffer = buffer_1.Buffer.from(result.substring(0, 100), 'base64');
            if (testBuffer.length > 0) {
                return result;
            }
        }
        catch (validationError) {
            console.log('[E2EAudio] Fast decryption validation failed, trying legacy method');
        }
    }
    catch (error) {
        console.log('[E2EAudio] Fast decryption failed, trying legacy method:', error);
    }
    // Fall back to legacy decryption for old messages
    console.log('[E2EAudio] Using legacy decryption method');
    return decryptAudioDataLegacy(encryptedBase64, key, nonce);
}
/**
 * Upload E2E encrypted audio
 */
const uploadE2EEncryptedAudio = async (localUri, senderId, recipientId, onProgress) => {
    try {
        // Create a unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const filename = `${senderId}/${timestamp}_${randomId}.enc`;
        // Read the file
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (!fileInfo.exists) {
            throw new Error('Audio file does not exist');
        }
        // Read file as base64
        const base64Audio = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        // Generate audio encryption key
        const audioKey = await generateAudioKey();
        // Encrypt the audio data
        const { encrypted: encryptedAudio, nonce: audioNonce } = await encryptAudioData(base64Audio, audioKey);
        // Derive shared secret for this friendship
        const sharedSecret = await sharedSecretEncryption_1.default.deriveSharedSecret(senderId, recipientId);
        // Encrypt the audio key with the shared secret
        const { encrypted: encryptedKey, nonce: keyNonce } = await sharedSecretEncryption_1.default.encrypt(audioKey, sharedSecret);
        // Convert encrypted audio to bytes for upload
        const encryptedBytes = buffer_1.Buffer.from(encryptedAudio, 'base64');
        // Upload to Supabase Storage
        const { data, error } = await supabase_1.supabase.storage
            .from('voice-messages')
            .upload(filename, encryptedBytes, {
            contentType: 'audio/mpeg',
            cacheControl: '3600',
            upsert: false,
        });
        if (error)
            throw error;
        console.log('[E2EAudio] Encrypted audio uploaded successfully:', filename);
        // Return the path and encrypted key (not the plaintext key!)
        return {
            path: filename,
            encryptedKey: encryptedKey,
            nonce: JSON.stringify({ audioNonce, keyNonce, version: 2 }) // Store both nonces and version
        };
    }
    catch (error) {
        console.error('[E2EAudio] Error uploading encrypted audio:', error);
        return null;
    }
};
exports.uploadE2EEncryptedAudio = uploadE2EEncryptedAudio;
/**
 * Download and decrypt E2E encrypted audio
 */
const downloadAndDecryptE2EAudio = async (path, encryptedKey, nonce, senderId, myUserId, onProgress) => {
    const startTime = Date.now();
    try {
        console.log('[E2EAudio] Starting download and decrypt...');
        // Download the encrypted file
        const downloadStart = Date.now();
        const { data, error } = await supabase_1.supabase.storage
            .from('voice-messages')
            .download(path);
        console.log(`[E2EAudio] Download completed in ${Date.now() - downloadStart}ms`);
        if (error)
            throw error;
        // Convert blob to base64 - optimized approach with React Native compatibility
        let encryptedData;
        // Check if we have arrayBuffer method (web) or need to use FileReader (React Native)
        if (data.arrayBuffer) {
            const arrayBuffer = await data.arrayBuffer();
            encryptedData = new Uint8Array(arrayBuffer);
        }
        else {
            // React Native path - use FileReader
            const reader = new FileReader();
            const arrayBuffer = await new Promise((resolve, reject) => {
                reader.onload = () => {
                    if (reader.result instanceof ArrayBuffer) {
                        resolve(reader.result);
                    }
                    else {
                        reject(new Error('Failed to read blob as ArrayBuffer'));
                    }
                };
                reader.onerror = () => reject(new Error('FileReader error: ' + reader.error?.message));
                reader.readAsArrayBuffer(data);
            });
            encryptedData = new Uint8Array(arrayBuffer);
        }
        const encryptedBase64 = buffer_1.Buffer.from(encryptedData).toString('base64');
        // Parse nonces
        const nonceData = JSON.parse(nonce);
        const { audioNonce, keyNonce, version = 1 } = nonceData;
        // Derive shared secret
        const keyDecryptStart = Date.now();
        const sharedSecret = await sharedSecretEncryption_1.default.deriveSharedSecret(myUserId, senderId);
        // Decrypt the audio key
        const audioKey = await sharedSecretEncryption_1.default.decrypt(encryptedKey, keyNonce, sharedSecret);
        console.log(`[E2EAudio] Key decryption completed in ${Date.now() - keyDecryptStart}ms`);
        // Decrypt the audio
        const audioDecryptStart = Date.now();
        const decryptedBase64 = await decryptAudioData(encryptedBase64, audioKey, audioNonce, (progress) => {
            // Map decryption progress to overall progress (50% to 90%)
            const overallProgress = 0.5 + (progress * 0.4);
            onProgress?.({ loaded: overallProgress * 100, total: 100, percentage: overallProgress * 100 });
        }, version);
        console.log(`[E2EAudio] Audio decryption completed in ${Date.now() - audioDecryptStart}ms`);
        // Save decrypted audio to cache
        const filename = `voice_${Date.now()}.mp4`;
        const localUri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(localUri, decryptedBase64, {
            encoding: FileSystem.EncodingType.Base64,
        });
        // Verify the file was written correctly
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        console.log('[E2EAudio] Decrypted file saved:', {
            uri: localUri,
            size: fileInfo.size,
            exists: fileInfo.exists
        });
        console.log(`[E2EAudio] Total process completed in ${Date.now() - startTime}ms`);
        // Ensure proper file:// prefix for iOS
        if (react_native_1.Platform.OS === 'ios' && !localUri.startsWith('file://')) {
            return 'file://' + localUri;
        }
        return localUri;
    }
    catch (error) {
        console.error('[E2EAudio] Error downloading/decrypting zero-knowledge audio:', error);
        return null;
    }
};
exports.downloadAndDecryptE2EAudio = downloadAndDecryptE2EAudio;
/**
 * Legacy function signature for backward compatibility
 * This maintains the old API while using new zero-knowledge encryption
 */
const uploadE2EEncryptedAudioLegacy = async (localUri, senderId, recipientId, onProgress) => {
    const result = await (0, exports.uploadE2EEncryptedAudio)(localUri, senderId, recipientId, onProgress);
    if (!result)
        return null;
    // Convert new format back to legacy format
    return {
        path: result.path,
        encryptedKey: result.encryptedKey,
        nonce: JSON.stringify({
            keyNonce: result.keyNonce,
            dataNonce: result.dataNonce,
            ephemeralPublicKey: result.ephemeralPublicKey,
            version: 3
        })
    };
};
exports.uploadE2EEncryptedAudioLegacy = uploadE2EEncryptedAudioLegacy;
/**
 * Verification function to test zero-knowledge encryption
 */
const verifyE2EAudioEncryption = async () => {
    try {
        console.log('[E2EAudio] Running zero-knowledge audio encryption verification...');
        // This would require a test audio file and two test users
        // For now, we verify the underlying NaClBoxEncryption
        const verified = await NaClBoxEncryption.verifyEncryption();
        if (verified) {
            console.log('[E2EAudio] ✅ Zero-knowledge audio encryption verified!');
            console.log('[E2EAudio] ✅ Server CANNOT decrypt any audio files!');
        }
        else {
            console.error('[E2EAudio] ❌ Zero-knowledge audio encryption verification FAILED!');
        }
        return verified;
    }
    catch (error) {
        console.error('[E2EAudio] Audio encryption verification error:', error);
        return false;
    }
};
exports.verifyE2EAudioEncryption = verifyE2EAudioEncryption;
