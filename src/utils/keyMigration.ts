import { supabase } from '../services/supabase';
import { generateKeyPair } from './encryption';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Ensures the current user has encryption keys
 * This fixes the issue where existing users don't have keys
 */
export const ensureUserHasKeys = async (userId: string): Promise<{ publicKey: string; privateKey: string } | null> => {
  try {
    // First, check if user already has keys in the database
    const { data: userData } = await supabase
      .from('users')
      .select('public_key')
      .eq('id', userId)
      .single();

    // Check local storage for keys
    const storedKeys = await AsyncStorage.getItem(`vanishvoice_keys_${userId}`);
    
    if (userData?.public_key && storedKeys) {
      // User has keys, return them
      return JSON.parse(storedKeys);
    }

    // User doesn't have keys, generate them
    console.log('Generating new encryption keys for user:', userId);
    const newKeys = await generateKeyPair();
    
    // Store locally
    await AsyncStorage.setItem(`vanishvoice_keys_${userId}`, JSON.stringify(newKeys));
    
    // Update database
    const { error } = await supabase
      .from('users')
      .update({ 
        public_key: newKeys.publicKey,
        key_generated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user public key:', error);
      // Still return keys even if DB update fails
    }

    return newKeys;
  } catch (error) {
    console.error('Error ensuring user has keys:', error);
    return null;
  }
};