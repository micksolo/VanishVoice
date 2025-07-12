import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

interface AnonymousSession {
  sessionId: string;
  publicKey: string;
  privateKey: string;
  expiresAt: string;
  trustScore: number;
}

export const useAnonymousSession = () => {
  const [session, setSession] = useState<AnonymousSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeSession();
  }, []);

  const getDeviceHash = async (): Promise<string> => {
    // Create a stable device identifier
    const factors = [
      Device.modelName || 'unknown',
      Device.osBuildId || 'unknown',
      Platform.OS,
      Platform.Version,
    ];

    // Add a stored random ID for extra uniqueness
    let storedId = await AsyncStorage.getItem('wyd_device_id');
    if (!storedId) {
      storedId = await Crypto.getRandomBytesAsync(16).then(bytes => 
        Buffer.from(bytes).toString('hex')
      );
      await AsyncStorage.setItem('wyd_device_id', storedId);
    }
    
    factors.push(storedId);
    
    // Create hash
    const combined = factors.join('|');
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    
    return hash;
  };

  const initializeSession = async () => {
    try {
      // Check for existing valid session
      const storedSession = await AsyncStorage.getItem('wyd_anonymous_session');
      
      if (storedSession) {
        const parsed = JSON.parse(storedSession) as AnonymousSession;
        const expiresAt = new Date(parsed.expiresAt);
        
        if (expiresAt > new Date()) {
          // Session still valid
          setSession(parsed);
          setLoading(false);
          
          // Refresh session in background
          refreshSession(parsed.sessionId);
          return;
        }
      }

      // Create new session
      await createNewSession();
    } catch (err) {
      console.error('Error initializing session:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      // Generate device hash
      const deviceHash = await getDeviceHash();
      
      // Generate ephemeral key pair
      const keyPair = nacl.box.keyPair();
      const publicKey = Buffer.from(keyPair.publicKey).toString('base64');
      const privateKey = Buffer.from(keyPair.secretKey).toString('base64');

      // Call edge function to create session
      const { data, error } = await supabase.functions.invoke('create-anonymous-session', {
        body: {
          deviceHash,
          publicKey
        }
      });

      if (error) throw error;

      const newSession: AnonymousSession = {
        sessionId: data.sessionId,
        publicKey,
        privateKey,
        expiresAt: data.expiresAt,
        trustScore: data.trustScore
      };

      // Store session
      await AsyncStorage.setItem('wyd_anonymous_session', JSON.stringify(newSession));
      setSession(newSession);

      return newSession;
    } catch (err) {
      console.error('Error creating session:', err);
      throw err;
    }
  };

  const refreshSession = async (sessionId: string) => {
    try {
      // Update last active timestamp
      const { error } = await supabase
        .from('anonymous_sessions')
        .update({ last_active: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) {
        console.warn('Failed to refresh session:', error);
      }
    } catch (err) {
      console.warn('Error refreshing session:', err);
    }
  };

  const endSession = async () => {
    if (!session) return;

    try {
      // Remove from any active conversations/waiting pool
      await supabase
        .from('waiting_pool')
        .delete()
        .eq('session_id', session.sessionId);

      // Clear local storage
      await AsyncStorage.removeItem('wyd_anonymous_session');
      setSession(null);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  };

  return {
    session,
    loading,
    error,
    createNewSession,
    endSession,
    deviceHash: getDeviceHash
  };
};