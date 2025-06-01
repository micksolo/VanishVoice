import React, { createContext, useContext, useEffect, useState } from 'react';
import { getOrCreateAnonymousUser, clearAnonymousUser, AnonymousUser } from '../utils/anonymousAuth';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateKeyPair } from '../utils/encryption';

interface AuthContextType {
  user: AnonymousUser | null;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  userKeys: { publicKey: string; privateKey: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AnonymousUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userKeys, setUserKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const anonymousUser = await getOrCreateAnonymousUser();
      setUser(anonymousUser);
      
      // Load or generate encryption keys
      await loadOrGenerateKeys(anonymousUser.id);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadOrGenerateKeys = async (userId: string) => {
    try {
      // Try to load existing keys
      const storedKeys = await AsyncStorage.getItem(`vanishvoice_keys_${userId}`);
      
      if (storedKeys) {
        setUserKeys(JSON.parse(storedKeys));
      } else {
        // Generate new keys
        const keys = await generateKeyPair();
        setUserKeys(keys);
        
        // Store keys locally
        await AsyncStorage.setItem(`vanishvoice_keys_${userId}`, JSON.stringify(keys));
        
        // Update user's public key in database
        await supabase
          .from('users')
          .update({ 
            public_key: keys.publicKey,
            key_generated_at: new Date().toISOString()
          })
          .eq('id', userId);
      }
    } catch (error) {
      console.error('Error managing encryption keys:', error);
    }
  };

  const signInAnonymously = async () => {
    try {
      setLoading(true);
      const anonymousUser = await getOrCreateAnonymousUser();
      setUser(anonymousUser);
      
      // Load or generate encryption keys
      await loadOrGenerateKeys(anonymousUser.id);
    } catch (error) {
      console.error('Error signing in anonymously:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await clearAnonymousUser();
      setUser(null);
      setUserKeys(null);
      // Create a new anonymous user immediately
      const newUser = await getOrCreateAnonymousUser();
      setUser(newUser);
      
      // Generate new keys for new user
      await loadOrGenerateKeys(newUser.id);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    
    try {
      const { data: refreshedUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (refreshedUser) {
        setUser(refreshedUser);
        await AsyncStorage.setItem('vanishvoice_anon_user', JSON.stringify(refreshedUser));
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInAnonymously, signOut, refreshUser, userKeys }}>
      {children}
    </AuthContext.Provider>
  );
};