import React, { createContext, useContext, useEffect, useState } from 'react';
import { getOrCreateAnonymousUser, clearAnonymousUser, AnonymousUser } from '../utils/anonymousAuth';

interface AuthContextType {
  user: AnonymousUser | null;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
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

  return (
    <AuthContext.Provider value={{ user, loading, signInAnonymously, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};