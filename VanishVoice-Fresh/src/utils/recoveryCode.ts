// Recovery code system for account backup
// Generates memorable recovery codes like "HAPPY-PANDA-2024-SWIFT"

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

const RECOVERY_CODE_KEY = 'wyd_recovery_code';

// Word lists for recovery codes
const words1 = ['HAPPY', 'SWIFT', 'BRAVE', 'LUCKY', 'SUNNY', 'EPIC', 'COOL', 'WILD'];
const words2 = ['PANDA', 'EAGLE', 'TIGER', 'DRAGON', 'PHOENIX', 'LION', 'WOLF', 'STAR'];
const words3 = ['FLASH', 'STORM', 'WAVE', 'MOON', 'FIRE', 'ICE', 'WIND', 'NOVA'];

export const generateRecoveryCode = (): string => {
  const word1 = words1[Math.floor(Math.random() * words1.length)];
  const word2 = words2[Math.floor(Math.random() * words2.length)];
  const number = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const word3 = words3[Math.floor(Math.random() * words3.length)];
  
  return `${word1}-${word2}-${number}-${word3}`;
};

export const saveRecoveryCode = async (userId: string, recoveryCode: string): Promise<boolean> => {
  try {
    // Hash the recovery code before storing in database
    const hashedCode = await hashRecoveryCode(recoveryCode);
    
    // Store hashed code in database
    const { error } = await supabase
      .from('user_recovery')
      .upsert({
        user_id: userId,
        recovery_code_hash: hashedCode,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error saving recovery code:', error);
      return false;
    }
    
    // Store the actual code locally for display
    await AsyncStorage.setItem(RECOVERY_CODE_KEY, recoveryCode);
    
    return true;
  } catch (error) {
    console.error('Error in saveRecoveryCode:', error);
    return false;
  }
};

export const getStoredRecoveryCode = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(RECOVERY_CODE_KEY);
  } catch (error) {
    console.error('Error getting stored recovery code:', error);
    return null;
  }
};

// Simple hash function (in production, use proper crypto)
const hashRecoveryCode = async (code: string): Promise<string> => {
  // For now, just a simple transformation
  // In production, use proper hashing like bcrypt
  const encoder = new TextEncoder();
  const data = encoder.encode(code + 'wyd-salt-2024');
  
  // Simple hash for MVP - replace with crypto.subtle.digest in production
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
};

export interface RecoveryData {
  userId: string;
  username: string;
  friendCode: string;
  createdAt: string;
}

export const recoverAccount = async (recoveryCode: string): Promise<RecoveryData | null> => {
  try {
    const hashedCode = await hashRecoveryCode(recoveryCode);
    
    // Find user by recovery code
    const { data, error } = await supabase
      .from('user_recovery')
      .select(`
        user_id,
        users!inner(
          id,
          username,
          friend_code,
          created_at
        )
      `)
      .eq('recovery_code_hash', hashedCode)
      .single();
    
    if (error || !data) {
      console.error('Recovery code not found:', error);
      return null;
    }
    
    return {
      userId: data.users.id,
      username: data.users.username,
      friendCode: data.users.friend_code,
      createdAt: data.users.created_at
    };
  } catch (error) {
    console.error('Error recovering account:', error);
    return null;
  }
};