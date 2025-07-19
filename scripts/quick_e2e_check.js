#!/usr/bin/env node

/**
 * Quick script to verify E2E encryption
 * Run with: node scripts/quick_e2e_check.js
 */

console.log('🔍 Checking E2E Voice Encryption...\n');

// Instructions for manual verification
console.log('To verify E2E encryption is working:\n');

console.log('1. In your app, go to Profile > Debug Settings > Verify Voice E2E Encryption');
console.log('   This will show you the encryption status of your voice messages.\n');

console.log('2. To manually check the database:');
console.log('   - Go to your Supabase dashboard');
console.log('   - Navigate to Table Editor > messages');
console.log('   - Filter by type = "voice"');
console.log('   - Look at recent voice messages\n');

console.log('What to look for:');
console.log('✅ The "content" column should contain encrypted keys (base64 strings)');
console.log('✅ The "nonce" column should contain JSON with audioNonce and keyNonce');
console.log('✅ The "is_encrypted" column should be true');
console.log('❌ There should be NO "encryption_key" or "encryption_iv" columns\n');

console.log('Example of properly encrypted voice message:');
console.log('- content: "Fq+3X2B5Y8K2N3..." (encrypted key)');
console.log('- nonce: {"audioNonce":"abc...","keyNonce":"xyz..."}');
console.log('- media_path: "user-id/timestamp_random.enc"');
console.log('- is_encrypted: true\n');

console.log('If you see plaintext keys or the old encryption_key/encryption_iv columns,');
console.log('the migration may not have run yet.\n');

console.log('To run the migration manually:');
console.log('1. Go to Supabase dashboard > SQL Editor');
console.log('2. Run the migration from: supabase/migrations/012_migrate_to_e2e_voice_encryption.sql\n');