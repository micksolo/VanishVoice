import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AnonymousAuthContext';

export default function RealtimeDebugger() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 20));
  };

  const testRealtimeConnection = async () => {
    addLog('Starting realtime connection test...');
    
    // Test 1: Basic channel subscription
    const testChannel = supabase.channel('test-channel');
    
    testChannel
      .subscribe((status, err) => {
        addLog(`Test channel status: ${status}`);
        if (err) addLog(`Test channel error: ${JSON.stringify(err)}`);
        
        if (status === 'SUBSCRIBED') {
          addLog('✅ Basic channel subscription working!');
          testChannel.unsubscribe();
          testDatabaseSubscription();
        }
      });
  };

  const testDatabaseSubscription = () => {
    if (!user) {
      addLog('❌ No user available for database test');
      return;
    }

    addLog('Testing database change subscription...');
    
    // Subscribe to messages table
    const channel = supabase
      .channel(`test-db-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          addLog(`📨 Database event received: ${payload.eventType}`);
          addLog(`Table: ${payload.table}, Schema: ${payload.schema}`);
        }
      )
      .subscribe((status) => {
        addLog(`Database subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          addLog('✅ Database subscription working!');
          
          // Clean up after 10 seconds
          setTimeout(() => {
            channel.unsubscribe();
            addLog('Test subscription cleaned up');
          }, 10000);
        }
      });
  };

  const checkRealtimeStatus = async () => {
    addLog('Checking Supabase configuration...');
    
    // Check if URL and key are configured
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    addLog(`Supabase URL: ${url ? '✅ Configured' : '❌ Missing'}`);
    addLog(`Supabase Key: ${key ? '✅ Configured' : '❌ Missing'}`);
    
    // Check auth status
    const { data: { session } } = await supabase.auth.getSession();
    addLog(`Auth session: ${session ? '✅ Active' : '❌ No session'}`);
    
    // Check if realtime is enabled in Supabase dashboard
    addLog('⚠️ Ensure Realtime is enabled for messages table in Supabase dashboard');
  };

  if (!isVisible) {
    return (
      <TouchableOpacity
        style={styles.debugButton}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.debugButtonText}>🐛</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Realtime Debugger</Text>
        <TouchableOpacity onPress={() => setIsVisible(false)}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={checkRealtimeStatus}>
          <Text style={styles.buttonText}>Check Config</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testRealtimeConnection}>
          <Text style={styles.buttonText}>Test Connection</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={() => setLogs([])}>
          <Text style={styles.buttonText}>Clear Logs</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.logs}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  debugButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  debugButtonText: {
    fontSize: 20,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 400,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#fff',
    fontSize: 24,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  logs: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    padding: 10,
  },
  logText: {
    color: '#00ff00',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 5,
  },
});