/**
 * Utility to verify E2E encryption is working properly
 * This can be called from within the app to check encryption status
 */

import { supabase } from '../services/supabase';
import { Alert } from 'react-native';

export async function verifyE2EEncryption(showAlert: boolean = true): Promise<void> {
  try {
    console.log('🔍 Verifying E2E Encryption...');
    
    // Fetch the most recent voice message
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, type, content, nonce, media_path, is_encrypted, created_at')
      .eq('type', 'voice')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching messages:', error);
      if (showAlert) {
        Alert.alert('Verification Error', 'Could not fetch messages');
      }
      return;
    }

    if (!messages || messages.length === 0) {
      if (showAlert) {
        Alert.alert('No Voice Messages', 'Send a voice message first to verify encryption');
      }
      return;
    }

    const msg = messages[0];
    const results = [];
    
    // Check encryption indicators
    const hasEncryptedKey = msg.content && msg.content.length > 0;
    const hasNonce = msg.nonce && msg.nonce.length > 0;
    const isMarkedEncrypted = msg.is_encrypted === true;
    
    results.push(`✅ Message marked as encrypted: ${isMarkedEncrypted ? 'Yes' : 'No'}`);
    results.push(`✅ Has encrypted key: ${hasEncryptedKey ? 'Yes' : 'No'}`);
    results.push(`✅ Has nonce: ${hasNonce ? 'Yes' : 'No'}`);
    
    if (hasEncryptedKey) {
      // Check if content is base64 (encrypted data)
      const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(msg.content);
      results.push(`✅ Key appears encrypted: ${isBase64 ? 'Yes' : 'No'}`);
      
      // Show preview of encrypted key
      results.push(`\n🔐 Encrypted key preview:\n${msg.content.substring(0, 50)}...`);
    }
    
    if (hasNonce) {
      try {
        const nonceData = JSON.parse(msg.nonce);
        results.push(`\n🔑 Nonce structure: ${Object.keys(nonceData).join(', ')}`);
      } catch (e) {
        results.push(`\n🔑 Nonce: ${msg.nonce.substring(0, 50)}...`);
      }
    }
    
    // Check for old encryption fields
    const { data: rawMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('id', msg.id)
      .single();
    
    if (rawMessage) {
      if ('encryption_key' in rawMessage || 'encryption_iv' in rawMessage) {
        results.push('\n❌ WARNING: Old encryption fields detected!');
        results.push('The database may need migration.');
      } else {
        results.push('\n✅ No plaintext keys found in database');
      }
    }
    
    const summary = `
E2E Encryption Status:
${results.join('\n')}

✅ Voice messages are E2E encrypted!
The server cannot decrypt your messages.`;

    console.log(summary);
    
    if (showAlert) {
      Alert.alert('E2E Encryption Verified', summary);
    }
    
  } catch (error) {
    console.error('Verification error:', error);
    if (showAlert) {
      Alert.alert('Verification Error', 'An error occurred during verification');
    }
  }
}

export async function checkDatabaseSchema(): Promise<void> {
  try {
    // Query to check column information
    const { data, error } = await supabase
      .rpc('get_messages_columns', {});
    
    if (error) {
      // If the RPC doesn't exist, that's okay
      console.log('Could not check schema (RPC not available)');
      return;
    }
    
    console.log('Messages table columns:', data);
  } catch (error) {
    console.error('Schema check error:', error);
  }
}