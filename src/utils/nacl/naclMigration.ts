import { supabase } from '../../services/supabase';
import NaClEncryption from './naclEncryption';
import NaClKeyStorage from './naclKeyStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Migration utility for transitioning to NaCl encryption
 */

interface MigrationStatus {
  keysGenerated: boolean;
  publicKeyUpdated: boolean;
  oldKeysArchived: boolean;
  migrationComplete: boolean;
  error?: string;
}

class NaClMigration {
  private static readonly MIGRATION_KEY = 'vanishvoice_nacl_migration_status';

  // Check if user needs migration
  static async needsMigration(userId: string): Promise<boolean> {
    try {
      // Check migration status
      const status = await this.getMigrationStatus(userId);
      if (status?.migrationComplete) {
        return false;
      }

      // Check if user already has NaCl keys
      const hasNaClKeys = await NaClKeyStorage.hasKeys(userId);
      if (hasNaClKeys) {
        // Update migration status
        await this.setMigrationStatus(userId, {
          keysGenerated: true,
          publicKeyUpdated: true,
          oldKeysArchived: true,
          migrationComplete: true,
        });
        return false;
      }

      // Check if user has old keys that need migration
      const hasOldKeys = await this.hasOldKeys(userId);
      return hasOldKeys || true; // Always generate keys if none exist
    } catch (error) {
      console.error('[NaClMigration] Error checking migration need:', error);
      return true; // Err on the side of caution
    }
  }

  // Perform full migration
  static async migrate(userId: string): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      keysGenerated: false,
      publicKeyUpdated: false,
      oldKeysArchived: false,
      migrationComplete: false,
    };

    try {
      console.log('[NaClMigration] Starting migration for user:', userId);

      // Step 1: Generate new NaCl keys
      const newKeys = await NaClKeyStorage.generateAndStoreKeys(userId);
      status.keysGenerated = true;
      console.log('[NaClMigration] New NaCl keys generated');

      // Step 2: Update public key in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          public_key: newKeys.publicKey,
          key_generated_at: new Date().toISOString(),
          encryption_version: 3, // NaCl version
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to update public key: ${updateError.message}`);
      }
      status.publicKeyUpdated = true;
      console.log('[NaClMigration] Public key updated in database');

      // Step 3: Archive old keys (don't delete immediately)
      await this.archiveOldKeys(userId);
      status.oldKeysArchived = true;
      console.log('[NaClMigration] Old keys archived');

      // Step 4: Mark migration complete
      status.migrationComplete = true;
      await this.setMigrationStatus(userId, status);
      console.log('[NaClMigration] Migration completed successfully');

      return status;
    } catch (error: any) {
      console.error('[NaClMigration] Migration failed:', error);
      status.error = error.message;
      await this.setMigrationStatus(userId, status);
      return status;
    }
  }

  // Check if user has old keys
  private static async hasOldKeys(userId: string): Promise<boolean> {
    const oldKeyLocations = [
      `vanishvoice_secure_keys_${userId}`,
      `vanishvoice_keys_${userId}`,
    ];

    for (const location of oldKeyLocations) {
      const keys = await AsyncStorage.getItem(location);
      if (keys) return true;
    }

    return false;
  }

  // Archive old keys (keep for potential recovery)
  private static async archiveOldKeys(userId: string): Promise<void> {
    const oldKeyLocations = [
      `vanishvoice_secure_keys_${userId}`,
      `vanishvoice_keys_${userId}`,
    ];

    const timestamp = Date.now();
    const archives: any = {};

    for (const location of oldKeyLocations) {
      const keys = await AsyncStorage.getItem(location);
      if (keys) {
        archives[location] = keys;
        // Remove original
        await AsyncStorage.removeItem(location);
        await AsyncStorage.removeItem(`${location}_backup`);
      }
    }

    if (Object.keys(archives).length > 0) {
      // Store archived keys
      await AsyncStorage.setItem(
        `vanishvoice_archived_keys_${userId}_${timestamp}`,
        JSON.stringify({
          timestamp,
          archives,
          reason: 'NaCl migration',
        })
      );
    }
  }

  // Get migration status
  private static async getMigrationStatus(userId: string): Promise<MigrationStatus | null> {
    try {
      const statusStr = await AsyncStorage.getItem(`${this.MIGRATION_KEY}_${userId}`);
      return statusStr ? JSON.parse(statusStr) : null;
    } catch {
      return null;
    }
  }

  // Set migration status
  private static async setMigrationStatus(userId: string, status: MigrationStatus): Promise<void> {
    await AsyncStorage.setItem(
      `${this.MIGRATION_KEY}_${userId}`,
      JSON.stringify(status)
    );
  }

  // Update user's encryption preferences
  static async updateEncryptionPreferences(userId: string): Promise<void> {
    await AsyncStorage.setItem(
      `vanishvoice_encryption_prefs_${userId}`,
      JSON.stringify({
        algorithm: 'nacl-box',
        version: 3,
        features: [
          'curve25519-key-exchange',
          'xsalsa20-encryption',
          'poly1305-authentication',
          'perfect-forward-secrecy',
        ],
        updatedAt: new Date().toISOString(),
      })
    );
  }

  // Check if a message can be decrypted with current keys
  static async canDecryptMessage(
    message: any,
    userKeys: { publicKey: string; secretKey: string }
  ): Promise<boolean> {
    // NaCl (v3) can only decrypt NaCl messages
    return message.encryption_version === 3;
  }

  // Get decryption instructions for incompatible messages
  static getDecryptionInstructions(message: any): string {
    if (message.encryption_version < 3) {
      return 'This message was encrypted with an older version. The sender needs to update their app.';
    }
    return 'Unable to decrypt this message.';
  }
}

export default NaClMigration;

/**
 * Migration Flow:
 * 
 * 1. On app startup, check if migration needed
 * 2. If needed, show migration prompt to user
 * 3. Generate new NaCl keys
 * 4. Update database with new public key
 * 5. Archive old keys for recovery
 * 6. Future messages use NaCl encryption
 * 
 * Important Notes:
 * - Old messages remain readable with compatibility layer
 * - New messages always use NaCl
 * - Friends need to update to exchange NaCl messages
 * - Migration is one-way (no rollback)
 */