import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// These will be filled in when you create your Supabase project
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Enable realtime for message delivery
  realtime: {
    params: {
      eventsPerSecond: 10
    },
    // Add timeout and heartbeat settings
    timeout: 10000,
    heartbeatIntervalMs: 30000,
  },
});

// Debug helper to check realtime connection
export const debugRealtimeConnection = () => {
  const channel = supabase.channel('debug-test');
  
  channel
    .on('system', { event: '*' }, (payload) => {
      console.log('[Realtime Debug] System event:', payload);
    })
    .on('presence', { event: 'sync' }, () => {
      console.log('[Realtime Debug] Presence sync');
    })
    .subscribe((status, err) => {
      console.log('[Realtime Debug] Channel status:', status);
      if (err) console.error('[Realtime Debug] Channel error:', err);
      
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime Debug] Successfully connected to realtime!');
        // Clean up test channel
        setTimeout(() => {
          channel.unsubscribe();
        }, 5000);
      }
    });
};