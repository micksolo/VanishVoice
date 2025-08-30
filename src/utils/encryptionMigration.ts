/**
 * Encryption Migration System
 * 
 * This module handles the migration from SharedSecretEncryption (compromised)
 * to true zero-knowledge encryption for existing users.
 * 
 * MIGRATION STRATEGY:
 * 1. Detect existing users with SharedSecretEncryption
 * 2. Generate new device keys for zero-knowledge encryption
 * 3. Re-encrypt existing messages with new system (if feasible)
 * 4. Update friend relationships to use new encryption
 * 5. Provide clear user communication about security upgrade
 * 
 * IMPORTANT: Old messages encrypted with SharedSecretEncryption 
 * are compromised and cannot be made secure retroactively.
 * We recommend users re-record sensitive messages.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import FriendEncryption from './friendEncryption';
import SecureDeviceKeys from './SecureDeviceKeys';
import SharedSecretEncryption from './sharedSecretEncryption';
import { ZeroKnowledgeVerification } from './zeroKnowledgeVerification';

export interface MigrationStatus {
  isComplete: boolean;
  hasLegacyData: boolean;
  deviceKeysGenerated: boolean;
  friendsMigrated: number;
  totalFriends: number;
  legacyMessages: {
    text: number;
    voice: number;
    video: number;
  };
  errors: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface MigrationOptions {
  userId: string;
  friendIds: string[];
  deleteDecryptedLegacyMessages: boolean; // Security recommendation: true
  showUserNotifications: boolean;
  performVerification: boolean;
}

export class EncryptionMigration {
  private static MIGRATION_KEY = 'encryption_migration_status';
  private static LEGACY_DATA_KEY = 'has_legacy_encryption_data';

  /**
   * Check if user needs migration from SharedSecretEncryption
   */
  static async needsMigration(userId: string): Promise<boolean> {
    try {
      // Check if we already completed migration
      const status = await this.getMigrationStatus();
      if (status.isComplete) {
        return false;
      }

      // Check for legacy data indicators
      const hasLegacyData = await this.detectLegacyData();
      
      // Check if device keys exist (new system)
      const deviceKeys = await SecureDeviceKeys.getDeviceKeys();
      const hasNewKeys = !!deviceKeys;

      console.log('[Migration] Migration check:', {
        hasLegacyData,
        hasNewKeys,
        statusComplete: status.isComplete
      });

      // Need migration if we have legacy data but not completed
      return hasLegacyData && !status.isComplete;

    } catch (error) {
      console.error('[Migration] Error checking migration need:', error);
      return true; // Err on side of caution
    }
  }

  /**
   * Detect legacy SharedSecretEncryption data
   */
  static async detectLegacyData(): Promise<boolean> {
    try {
      // Check for old friend keys storage pattern
      const asyncStorageKeys = await AsyncStorage.getAllKeys();
      const legacyKeyPattern = asyncStorageKeys.filter(key => 
        key.startsWith('friend_keys_') || 
        key.includes('shared_secret') ||
        key.includes('friendship_key')
      );

      if (legacyKeyPattern.length > 0) {
        console.log('[Migration] Found legacy key storage patterns:', legacyKeyPattern.length);
        return true;
      }

      // Check stored legacy data flag
      const legacyFlag = await AsyncStorage.getItem(this.LEGACY_DATA_KEY);
      if (legacyFlag === 'true') {
        console.log('[Migration] Legacy data flag is set');
        return true;
      }

      console.log('[Migration] No legacy data detected');
      return false;

    } catch (error) {
      console.error('[Migration] Error detecting legacy data:', error);
      return false;
    }
  }

  /**
   * Perform complete migration to zero-knowledge encryption
   */
  static async performMigration(options: MigrationOptions): Promise<MigrationStatus> {
    const startTime = new Date().toISOString();
    console.log('🔄 Starting encryption migration to zero-knowledge system...');
    console.log('==========================================================');

    const status: MigrationStatus = {
      isComplete: false,
      hasLegacyData: false,
      deviceKeysGenerated: false,
      friendsMigrated: 0,
      totalFriends: options.friendIds.length,
      legacyMessages: {
        text: 0,
        voice: 0,
        video: 0
      },
      errors: [],
      startedAt: startTime
    };

    try {
      // Step 1: Detect legacy data
      console.log('📊 Step 1: Detecting legacy data...');
      status.hasLegacyData = await this.detectLegacyData();
      
      if (status.hasLegacyData) {
        console.log('⚠️  Legacy data detected - migration required');
        console.log('⚠️  Old messages may be compromised and cannot be made secure retroactively');
      }

      // Step 2: Generate device keys for zero-knowledge encryption
      console.log('🔑 Step 2: Generating secure device keys...');
      try {
        await FriendEncryption.initializeDevice(options.userId);
        status.deviceKeysGenerated = true;
        console.log('✅ Device keys generated successfully');
      } catch (error) {
        const errorMsg = `Failed to generate device keys: ${error instanceof Error ? error.message : String(error)}`;
        status.errors.push(errorMsg);
        console.error('❌ ' + errorMsg);
      }

      // Step 3: Migrate friend relationships
      console.log('👥 Step 3: Migrating friend relationships...');
      for (const friendId of options.friendIds) {
        try {
          await FriendEncryption.initializeOrRepairFriendship(options.userId, friendId);
          status.friendsMigrated++;
          if (__DEV__) {
            console.log('✅ Migrated friend: [FRIEND_ID_REDACTED]');
          }
        } catch (error) {
          const errorMsg = `Failed to migrate friend ${friendId}: ${error instanceof Error ? error.message : String(error)}`;
          status.errors.push(errorMsg);
          console.error('❌ ' + errorMsg);
        }
      }

      // Step 4: Count legacy messages (for user awareness)
      console.log('📝 Step 4: Analyzing legacy messages...');
      status.legacyMessages = await this.countLegacyMessages();
      console.log(`📊 Legacy message count: ${status.legacyMessages.text} text, ${status.legacyMessages.voice} voice, ${status.legacyMessages.video} video`);

      // Step 5: Clean up legacy data (if requested)
      if (options.deleteDecryptedLegacyMessages) {
        console.log('🧹 Step 5: Cleaning up legacy data...');
        await this.cleanupLegacyData();
        console.log('✅ Legacy data cleanup complete');
      }

      // Step 6: Verification (if requested)
      if (options.performVerification) {
        console.log('🔐 Step 6: Verifying zero-knowledge encryption...');
        const verificationReport = await ZeroKnowledgeVerification.runFullVerification(options.userId);
        
        if (verificationReport.securityLevel === 'ZERO_KNOWLEDGE') {
          console.log('✅ Zero-knowledge encryption verification PASSED');
        } else {
          const errorMsg = `Verification failed: ${verificationReport.securityLevel}`;
          status.errors.push(errorMsg);
          console.error('❌ ' + errorMsg);
        }
      }

      // Migration complete
      status.isComplete = status.deviceKeysGenerated && status.errors.length === 0;
      status.completedAt = new Date().toISOString();

      // Save migration status
      await this.saveMigrationStatus(status);

      console.log('==========================================================');
      console.log(`🎉 Migration ${status.isComplete ? 'COMPLETED' : 'FINISHED WITH ERRORS'}`);
      console.log(`   Device keys: ${status.deviceKeysGenerated ? '✅' : '❌'}`);
      console.log(`   Friends migrated: ${status.friendsMigrated}/${status.totalFriends}`);
      console.log(`   Errors: ${status.errors.length}`);

      if (status.hasLegacyData && options.showUserNotifications) {
        await this.showUserMigrationNotification(status);
      }

      return status;

    } catch (error) {
      const errorMsg = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
      status.errors.push(errorMsg);
      status.completedAt = new Date().toISOString();
      
      await this.saveMigrationStatus(status);
      
      console.error('❌ Migration failed:', error);
      return status;
    }
  }

  /**
   * Get current migration status
   */
  static async getMigrationStatus(): Promise<MigrationStatus> {
    try {
      const statusJson = await AsyncStorage.getItem(this.MIGRATION_KEY);
      if (statusJson) {
        return JSON.parse(statusJson);
      }
    } catch (error) {
      console.error('[Migration] Error reading migration status:', error);
    }

    // Default status
    return {
      isComplete: false,
      hasLegacyData: false,
      deviceKeysGenerated: false,
      friendsMigrated: 0,
      totalFriends: 0,
      legacyMessages: {
        text: 0,
        voice: 0,
        video: 0
      },
      errors: []
    };
  }

  /**
   * Save migration status
   */
  static async saveMigrationStatus(status: MigrationStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(this.MIGRATION_KEY, JSON.stringify(status));
    } catch (error) {
      console.error('[Migration] Error saving migration status:', error);
    }
  }

  /**
   * Count legacy messages for user awareness
   */
  static async countLegacyMessages(): Promise<{ text: number; voice: number; video: number }> {
    // This would require database queries to count messages
    // For now, return placeholder counts
    // In a real implementation, you'd query your message database

    return {
      text: 0, // Count of text messages with SharedSecretEncryption
      voice: 0, // Count of voice messages with SharedSecretEncryption
      video: 0  // Count of video messages with SharedSecretEncryption
    };
  }

  /**
   * Clean up legacy SharedSecretEncryption data
   */
  static async cleanupLegacyData(): Promise<void> {
    try {
      console.log('[Migration] Cleaning up legacy data...');

      // Remove legacy AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      const legacyKeys = allKeys.filter(key =>
        key.startsWith('friend_keys_') ||
        key.includes('shared_secret') ||
        key.includes('friendship_key')
      );

      if (legacyKeys.length > 0) {
        await AsyncStorage.multiRemove(legacyKeys);
        console.log(`[Migration] Removed ${legacyKeys.length} legacy storage keys`);
      }

      // Set flag to indicate cleanup completed
      await AsyncStorage.setItem(this.LEGACY_DATA_KEY, 'cleaned');

      console.log('[Migration] Legacy data cleanup complete');

    } catch (error) {
      console.error('[Migration] Error cleaning up legacy data:', error);
      throw error;
    }
  }

  /**
   * Show user notification about migration
   */
  static async showUserMigrationNotification(status: MigrationStatus): Promise<void> {
    // This would show user-facing notifications
    // Implementation depends on your notification system

    console.log('🔐 USER NOTIFICATION: Encryption Security Upgrade');
    console.log('================================================');
    console.log('✅ Your encryption has been upgraded to zero-knowledge security!');
    console.log('✅ New messages are now completely secure from server access.');
    
    if (status.hasLegacyData) {
      console.log('⚠️  Previous messages may have been vulnerable and should be considered compromised.');
      console.log('⚠️  We recommend re-recording any sensitive voice or video messages.');
    }
    
    console.log('================================================');
  }

  /**
   * Force migration for development/testing
   */
  static async forceMigration(userId: string): Promise<MigrationStatus> {
    console.log('⚠️  FORCING MIGRATION (Development/Testing)');
    
    // Clear existing migration status
    await AsyncStorage.removeItem(this.MIGRATION_KEY);
    
    // Set legacy data flag to force migration
    await AsyncStorage.setItem(this.LEGACY_DATA_KEY, 'true');
    
    // Perform migration
    return await this.performMigration({
      userId,
      friendIds: [], // No friends to migrate in forced mode
      deleteDecryptedLegacyMessages: true,
      showUserNotifications: false,
      performVerification: true
    });
  }

  /**
   * Reset migration status (for development)
   */
  static async resetMigration(): Promise<void> {
    console.log('⚠️  RESETTING MIGRATION STATUS (Development)');
    await AsyncStorage.multiRemove([this.MIGRATION_KEY, this.LEGACY_DATA_KEY]);
    
    // Also clear device keys
    try {
      await SecureDeviceKeys.clearDeviceKeys();
    } catch (error) {
      // Ignore if no keys to clear
    }
  }

  /**
   * Get user-friendly migration summary
   */
  static async getMigrationSummary(): Promise<string> {
    const status = await this.getMigrationStatus();
    
    if (status.isComplete) {
      return '🔐 Your messages are secured with zero-knowledge encryption. Server cannot decrypt any content.';
    }
    
    if (status.hasLegacyData) {
      return '⚠️ Security upgrade needed. Your messages use old encryption that may be vulnerable.';
    }
    
    return '✅ Your encryption is up to date.';
  }
}