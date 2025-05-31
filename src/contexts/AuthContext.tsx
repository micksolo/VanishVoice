import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  userProfile: UserProfile | null;
}

interface UserProfile {
  id: string;
  anon_id: string;
  friend_code: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error when no rows

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }
      
      if (data) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const signInAnonymously = async () => {
    try {
      setLoading(true);
      
      // Generate a unique anonymous ID using crypto-safe random
      const randomBytes = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(randomBytes);
      } else {
        // Fallback for environments without crypto
        for (let i = 0; i < 16; i++) {
          randomBytes[i] = Math.floor(Math.random() * 256);
        }
      }
      
      const hex = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      const anonId = `anon_${uuid}`;
      
      // Create a pseudo-anonymous account using email/password
      // Remove hyphens from UUID for email compatibility
      const emailId = uuid.replace(/-/g, '').substring(0, 20);
      const email = `vv${emailId}@gmail.com`;
      const password = `VanishVoice123!${Date.now()}`;
      
      // Try to sign up first
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            anon_id: anonId,
          },
        },
      });

      if (signUpError && signUpError.message !== 'User already registered') {
        throw signUpError;
      }

      // If signup failed because user exists, try to sign in
      if (signUpError) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }

      // Get the user from either signup or signin
      const user = signUpData?.user || (await supabase.auth.getUser()).data.user;

      // Create user profile if it doesn't exist
      if (user) {
        // First check if profile exists
        const { data: existingProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!existingProfile) {
          // Create new profile
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              anon_id: anonId
            });

          if (profileError) {
            console.error('Profile creation error:', profileError);
          }
        }
        
        await fetchUserProfile(user.id);
      }
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInAnonymously, signOut, userProfile }}>
      {children}
    </AuthContext.Provider>
  );
};