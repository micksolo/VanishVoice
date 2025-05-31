import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANON_USER_KEY = 'vanishvoice_anon_user';

export interface AnonymousUser {
  id: string;
  anon_id: string;
  friend_code: string;
  username?: string;
  avatar_seed?: string;
  created_at: string;
}

export const getOrCreateAnonymousUser = async (): Promise<AnonymousUser | null> => {
  try {
    // Check if we have a stored anonymous user
    const storedUser = await AsyncStorage.getItem(ANON_USER_KEY);
    
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      
      // Verify the user still exists in the database
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', parsedUser.id)
        .maybeSingle();
      
      if (existingUser && !error) {
        return existingUser;
      }
    }
    
    // Create a new anonymous user directly in the database
    const anonId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const userId = generateUUID();
    
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        id: userId,
        anon_id: anonId
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating anonymous user:', createError);
      return null;
    }
    
    // Store the user locally
    await AsyncStorage.setItem(ANON_USER_KEY, JSON.stringify(newUser));
    
    return newUser;
  } catch (error) {
    console.error('Error in getOrCreateAnonymousUser:', error);
    return null;
  }
};

export const clearAnonymousUser = async () => {
  await AsyncStorage.removeItem(ANON_USER_KEY);
};

// Generate a UUID v4
function generateUUID(): string {
  const randomBytes = new Uint8Array(16);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 16; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Set version (4) and variant bits
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;
  
  const hex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}