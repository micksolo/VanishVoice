import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLog } from '../utils/debugConfig';

// These will be filled in when you create your Supabase project
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dhzblvgfexkgkxhhdlpk.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoemJsdmdmZXhrZ2t4aGhkbHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1OTM0ODksImV4cCI6MjA2NDE2OTQ4OX0.GilGCcz6SqVucvoLuFWrX5UBP-J20U_kCDvArh4vhUI';

// Debug environment variables - detailed
console.log('🔧 Supabase Environment Check:');
console.log('process.env.EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('supabaseUrl variable:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING');
console.log('supabaseAnonKey variable:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');

// Validate environment variables
if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('⚠️  SUPABASE_URL is not configured. Please set EXPO_PUBLIC_SUPABASE_URL in .env file');
} else if (supabaseUrl === 'https://dhzblvgfexkgkxhhdlpk.supabase.co') {
  console.log('✅ Using hardcoded Supabase URL (development)');
}

if (!supabaseAnonKey || supabaseAnonKey === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder') {
  console.warn('⚠️  SUPABASE_ANON_KEY is not configured. Please set EXPO_PUBLIC_SUPABASE_ANON_KEY in .env file');
} else if (supabaseAnonKey.includes('dhzblvgfexkgkxhhdlpk')) {
  console.log('✅ Using hardcoded Supabase anon key (development)');
}

console.log('Supabase configured:', !!(supabaseUrl && supabaseAnonKey));

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
  global: {
    fetch: async (url, options = {}) => {
      console.log(`🌐 Supabase request: ${options.method || 'GET'} ${url}`);
      try {
        const response = await fetch(url, options);
        console.log(`🌐 Supabase response: ${response.status} ${response.statusText}`);
        return response;
      } catch (error) {
        console.error(`🚨 Supabase fetch error:`, error);
        throw error;
      }
    }
  }
});

// Debug helper to check realtime connection
export const debugRealtimeConnection = () => {
  const channel = supabase.channel('debug-test');
  
  channel
    .on('system', { event: '*' }, (payload) => {
      debugLog('REALTIME', 'System event:', payload);
    })
    .on('presence', { event: 'sync' }, () => {
      debugLog('REALTIME', 'Presence sync');
    })
    .subscribe((status, err) => {
      debugLog('REALTIME', 'Channel status:', status);
      if (err) debugLog('REALTIME', 'Channel error:', err);
      
      if (status === 'SUBSCRIBED') {
        debugLog('REALTIME', 'Successfully connected to realtime!');
        // Clean up test channel
        setTimeout(() => {
          channel.unsubscribe();
        }, 5000);
      }
    });
};

// Test basic Supabase connection
export const testSupabaseConnection = async () => {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test 1: Basic health check
    const { error: healthError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (healthError) {
      console.error('❌ Supabase health check failed:', healthError);
      
      // Check if it's a table not found error (need to set up database)
      if (healthError.message?.includes('relation "public.users" does not exist')) {
        console.warn('⚠️  Database tables not set up. You need to create the users table in Supabase.');
        return { success: false, error: 'Database tables missing', needsSetup: true };
      }
      
      return { success: false, error: healthError.message };
    }
    
    console.log('✅ Supabase connection successful');
    return { success: true };
    
  } catch (error) {
    console.error('🚨 Supabase connection test failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
};