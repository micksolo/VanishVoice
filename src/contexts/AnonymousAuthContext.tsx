import React, { createContext, useContext, useEffect, useState } from 'react';
import { getOrCreateAnonymousUser, clearAnonymousUser, AnonymousUser } from '../utils/anonymousAuth';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: AnonymousUser | null;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
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

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const anonymousUser = await getOrCreateAnonymousUser();
      setUser(anonymousUser);
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const signInAnonymously = async () => {
    try {
      setLoading(true);
      const anonymousUser = await getOrCreateAnonymousUser();
      setUser(anonymousUser);
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
      // Create a new anonymous user immediately
      const newUser = await getOrCreateAnonymousUser();
      setUser(newUser);
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
    <AuthContext.Provider value={{ user, loading, signInAnonymously, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};