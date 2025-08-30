"use strict";
/**
 * Secure Device Keys Service
 *
 * This service manages device keypairs using secure hardware storage.
 * Each device generates a unique keypair on first launch and stores
 * the private key securely using react-native-keychain.
 *
 * SECURITY MODEL:
 * - Private keys stored in secure hardware (iOS Keychain, Android Keystore)
 * - Public keys stored in database for key exchange
 * - Server can NEVER access private keys
 * - Each device has unique keypair (not derived from user IDs)
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
const Keychain = __importStar(require("react-native-keychain"));
const supabase_1 = require("../services/supabase");
const naclEncryption_1 = __importDefault(require("./nacl/naclEncryption"));
class SecureDeviceKeys {
    /**
     * Generate and store new device keypair
     * Called on first app launch
     */
    static async generateDeviceKeys() {
        try {
            console.log('[SecureDeviceKeys] Generating new device keypair...');
            // Generate unique device ID
            const deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            // Generate NaCl keypair
            const keyPair = await naclEncryption_1.default.generateKeyPair();
            // Store private key in secure hardware
            await Keychain.setInternetCredentials(this.PRIVATE_KEY_SERVICE, this.PRIVATE_KEY_ACCOUNT, keyPair.secretKey, {
                accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
                accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
                authenticationType: Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
                securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
                storage: Keychain.STORAGE_TYPE.RSA,
            });
            // Store device ID separately
            await Keychain.setInternetCredentials(this.PRIVATE_KEY_SERVICE, this.DEVICE_ID_ACCOUNT, deviceId, {
                accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
                securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
            });
            console.log('[SecureDeviceKeys] Device keypair generated and stored securely');
            console.log(`[SecureDeviceKeys] Device ID: ${deviceId}`);
            console.log(`[SecureDeviceKeys] Public key: ${keyPair.publicKey.substring(0, 10)}...`);
            return {
                publicKey: keyPair.publicKey,
                privateKey: keyPair.secretKey,
                deviceId,
            };
        }
        catch (error) {
            console.error('[SecureDeviceKeys] Failed to generate device keys:', error);
            throw error;
        }
    }
    /**
     * Get existing device keypair from secure storage
     * Returns null if no keys exist
     */
    static async getDeviceKeys() {
        try {
            // Get private key
            const privateKeyCredentials = await Keychain.getInternetCredentials(this.PRIVATE_KEY_SERVICE, this.PRIVATE_KEY_ACCOUNT);
            // Get device ID
            const deviceIdCredentials = await Keychain.getInternetCredentials(this.PRIVATE_KEY_SERVICE, this.DEVICE_ID_ACCOUNT);
            if (!privateKeyCredentials || !deviceIdCredentials) {
                console.log('[SecureDeviceKeys] No device keys found in secure storage');
                return null;
            }
            const privateKey = privateKeyCredentials.password;
            const deviceId = deviceIdCredentials.password;
            // Derive public key from private key
            // Note: We could store public key too, but deriving it is more secure
            const keyPair = await naclEncryption_1.default.generateKeyPair();
            // Since we can't derive public from private in current NaClEncryption,
            // we'll need to store both or modify NaClEncryption
            // For now, we'll store device info in a way that works
            console.log('[SecureDeviceKeys] Retrieved device keys from secure storage');
            console.log(`[SecureDeviceKeys] Device ID: ${deviceId}`);
            // We need to get the public key from our database or regenerate
            // This is a limitation we'll address by storing public key locally too
            const publicKeyRecord = await this.getPublicKeyForDevice(deviceId);
            const publicKey = publicKeyRecord?.public_key || '';
            return {
                publicKey,
                privateKey,
                deviceId,
            };
        }
        catch (error) {
            console.error('[SecureDeviceKeys] Failed to get device keys:', error);
            return null;
        }
    }
    /**
     * Initialize device keys - generate if not exist, return existing if they do
     */
    static async initializeDeviceKeys() {
        const existingKeys = await this.getDeviceKeys();
        if (existingKeys && existingKeys.publicKey) {
            console.log('[SecureDeviceKeys] Using existing device keys');
            return existingKeys;
        }
        console.log('[SecureDeviceKeys] Generating new device keys');
        return await this.generateDeviceKeys();
    }
    /**
     * Publish device public key to database
     * Called after key generation or when user signs in
     */
    static async publishPublicKey(userId, deviceKeys) {
        try {
            console.log('[SecureDeviceKeys] Publishing public key to database...');
            const { error } = await supabase_1.supabase
                .from('device_public_keys')
                .upsert({
                user_id: userId,
                device_id: deviceKeys.deviceId,
                public_key: deviceKeys.publicKey,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,device_id'
            });
            if (error) {
                // If table doesn't exist, warn but don't fail
                if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
                    console.warn('[SecureDeviceKeys] device_public_keys table does not exist yet.');
                    console.warn('[SecureDeviceKeys] Please create migration for device_public_keys table');
                    return; // Don't throw, continue with local keys
                }
                throw error;
            }
            console.log('[SecureDeviceKeys] Public key published successfully');
        }
        catch (error) {
            console.error('[SecureDeviceKeys] Failed to publish public key:', error);
            throw error;
        }
    }
    /**
     * Get public key for a specific device
     */
    static async getPublicKeyForDevice(deviceId) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('device_public_keys')
                .select('*')
                .eq('device_id', deviceId)
                .single();
            if (error || !data) {
                console.log('[SecureDeviceKeys] Public key not found for device:', deviceId);
                return null;
            }
            return data;
        }
        catch (error) {
            console.error('[SecureDeviceKeys] Failed to get public key for device:', error);
            return null;
        }
    }
    /**
     * Get all public keys for a user (multiple devices)
     */
    static async getPublicKeysForUser(userId) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('device_public_keys')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) {
                console.error('[SecureDeviceKeys] Failed to get public keys for user:', error);
                return [];
            }
            return data || [];
        }
        catch (error) {
            console.error('[SecureDeviceKeys] Failed to get public keys for user:', error);
            return [];
        }
    }
    /**
     * Get the latest (most recent) public key for a user
     * This is used when we need to encrypt a message for someone
     */
    static async getLatestPublicKeyForUser(userId) {
        const publicKeys = await this.getPublicKeysForUser(userId);
        if (publicKeys.length === 0) {
            console.log('[SecureDeviceKeys] No public keys found for user:', userId);
            return null;
        }
        // Return the most recent public key
        const latestKey = publicKeys[0]; // Already ordered by created_at desc
        console.log(`[SecureDeviceKeys] Using latest public key for user ${userId}: ${latestKey.public_key.substring(0, 10)}...`);
        return latestKey.public_key;
    }
    /**
     * Clean up device keys (for logout or key rotation)
     */
    static async clearDeviceKeys() {
        try {
            console.log('[SecureDeviceKeys] Clearing device keys from secure storage...');
            await Keychain.resetInternetCredentials(this.PRIVATE_KEY_SERVICE, this.PRIVATE_KEY_ACCOUNT);
            await Keychain.resetInternetCredentials(this.PRIVATE_KEY_SERVICE, this.DEVICE_ID_ACCOUNT);
            console.log('[SecureDeviceKeys] Device keys cleared successfully');
        }
        catch (error) {
            console.error('[SecureDeviceKeys] Failed to clear device keys:', error);
            throw error;
        }
    }
    /**
     * Check if device has secure hardware support
     */
    static async hasSecureHardware() {
        try {
            const securityLevel = await Keychain.getSecurityLevel();
            return securityLevel === Keychain.SECURITY_LEVEL.SECURE_HARDWARE;
        }
        catch (error) {
            console.warn('[SecureDeviceKeys] Could not determine security level:', error);
            return false;
        }
    }
    /**
     * Get device security info for debugging
     */
    static async getSecurityInfo() {
        try {
            const hasSecureHardware = await this.hasSecureHardware();
            const securityLevel = await Keychain.getSecurityLevel();
            const hasBiometrics = await Keychain.getSupportedBiometryType();
            return {
                hasSecureHardware,
                securityLevel: securityLevel || 'unknown',
                hasBiometrics: hasBiometrics !== null,
            };
        }
        catch (error) {
            console.error('[SecureDeviceKeys] Failed to get security info:', error);
            return {
                hasSecureHardware: false,
                securityLevel: 'unknown',
                hasBiometrics: false,
            };
        }
    }
}
SecureDeviceKeys.PRIVATE_KEY_SERVICE = 'VanishVoice';
SecureDeviceKeys.PRIVATE_KEY_ACCOUNT = 'device_private_key';
SecureDeviceKeys.DEVICE_ID_ACCOUNT = 'device_id';
exports.default = SecureDeviceKeys;
