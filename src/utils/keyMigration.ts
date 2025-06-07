import { supabase } from '../services/supabase';
import { generateKeyPair } from './encryption';
import { generateSecureKeyPair } from './secureE2EEncryption';
import { storeKeysSecurely, retrieveKeysSecurely, migrateToSecureStorage } from './secureKeyStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NaClMigration from './nacl/naclMigration';
import NaClKeyStorage from './nacl/naclKeyStorage';

/**
 * Ensures the current user has encryption keys
 * This fixes the issue where existing users don't have keys
 */
export const ensureUserHasKeys = async (userId: string): Promise<{ publicKey: string; privateKey: string; secretKey?: string } | null> => {
  try {
    // Check if we need NaCl migration
    const needsNaClMigration = await NaClMigration.needsMigration(userId);
    
    if (needsNaClMigration) {
      console.log('User needs NaCl migration');
      const migrationStatus = await NaClMigration.migrate(userId);
      
      if (migrationStatus.migrationComplete) {
        const naclKeys = await NaClKeyStorage.retrieveKeys(userId);
        if (naclKeys) {
          // Return with secretKey alias for compatibility
          return {
            publicKey: naclKeys.publicKey,
            privateKey: naclKeys.secretKey,
            secretKey: naclKeys.secretKey,
          };
        }
      } else {
        console.error('NaCl migration failed:', migrationStatus.error);
      }
    }
    
    // Check if user already has NaCl keys
    const naclKeys = await NaClKeyStorage.retrieveKeys(userId);
    if (naclKeys) {
      console.log('User has NaCl keys');
      
      // Ensure keys are synced to database
      const { data: userData } = await supabase
        .from('users')
        .select('public_key, encryption_version')
        .eq('id', userId)
        .single();
      
      if (!userData?.public_key || userData.public_key !== naclKeys.publicKey) {
        console.log('Syncing NaCl public key to database...');
        const { error } = await supabase
          .from('users')
          .update({ 
            public_key: naclKeys.publicKey,
            key_generated_at: new Date().toISOString(),
            encryption_version: 3
          })
          .eq('id', userId);
        
        if (error) {
          console.error('Error syncing public key to database:', error);
        } else {
          console.log('NaCl public key synced to database successfully');
        }
      }
      
      return {
        publicKey: naclKeys.publicKey,
        privateKey: naclKeys.secretKey,
        secretKey: naclKeys.secretKey,
      };
    }
    
    // Fallback: Check old secure storage
    let keys = await retrieveKeysSecurely(userId);
    
    if (keys) {
      console.log('Found keys in old secure storage - user should migrate to NaCl');
      
      // Ensure old keys are synced to database
      const { data: userData } = await supabase
        .from('users')
        .select('public_key')
        .eq('id', userId)
        .single();
      
      if (!userData?.public_key) {
        console.log('Syncing old public key to database...');
        const { error } = await supabase
          .from('users')
          .update({ 
            public_key: keys.publicKey,
            key_generated_at: new Date().toISOString(),
            encryption_version: 2 // Old secure version
          })
          .eq('id', userId);
        
        if (error) {
          console.error('Error syncing old public key to database:', error);
        }
      }
      
      return keys;
    }
    
    // Check even older storage
    const oldKeys = await AsyncStorage.getItem(`vanishvoice_keys_${userId}`);
    if (oldKeys) {
      console.log('Found keys in legacy storage - user should migrate to NaCl');
      keys = JSON.parse(oldKeys);
      
      // Ensure legacy keys are synced to database
      const { data: userData } = await supabase
        .from('users')
        .select('public_key')
        .eq('id', userId)
        .single();
      
      if (!userData?.public_key) {
        console.log('Syncing legacy public key to database...');
        const { error } = await supabase
          .from('users')
          .update({ 
            public_key: keys.publicKey,
            key_generated_at: new Date().toISOString(),
            encryption_version: 1 // Legacy version
          })
          .eq('id', userId);
        
        if (error) {
          console.error('Error syncing legacy public key to database:', error);
        }
      }
      
      return keys;
    }

    // No keys found anywhere, generate new NaCl keys
    console.log('No keys found, generating new NaCl keys for user:', userId);
    const newNaClKeys = await NaClKeyStorage.generateAndStoreKeys(userId);
    
    // Update database with public key
    const { error } = await supabase
      .from('users')
      .update({ 
        public_key: newNaClKeys.publicKey,
        key_generated_at: new Date().toISOString(),
        encryption_version: 3 // NaCl version
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user public key:', error);
    }

    // Update encryption preferences
    await NaClMigration.updateEncryptionPreferences(userId);

    return {
      publicKey: newNaClKeys.publicKey,
      privateKey: newNaClKeys.secretKey,
      secretKey: newNaClKeys.secretKey,
    };
  } catch (error) {
    console.error('Error ensuring user has keys:', error);
    return null;
  }
};