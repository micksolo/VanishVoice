#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🔒 Running VanishVoice Security Tests\n');

try {
  // Test 1: Encryption Test
  console.log('1. Testing E2E Encryption...');
  console.log('---------------------------');
  try {
    execSync('node scripts/test_encryption.js', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
  } catch (e) {
    console.error('Encryption test failed:', e.message);
  }
  
  console.log('\n');
  
  // Test 2: Security Check
  console.log('2. Security Code Audit...');
  console.log('-------------------------');
  try {
    execSync('node scripts/security_check.js', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
  } catch (e) {
    console.error('Security check failed:', e.message);
  }
  
  console.log('\n');
  
  // Test 3: NPM Audit
  console.log('3. Dependency Security Audit...');
  console.log('--------------------------------');
  try {
    execSync('cd VanishVoice && npm audit', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
  } catch (e) {
    // npm audit returns non-zero on vulnerabilities
    console.log('Check npm audit results above.');
  }
  
  console.log('\n✅ Security tests complete!');
  console.log('\n📋 Additional Manual Checks:');
  console.log('1. Check Supabase dashboard for encrypted data');
  console.log('2. Verify messages between devices are encrypted');
  console.log('3. Run SQL: SELECT id, encryption_version FROM messages;');
  
} catch (error) {
  console.error('Error running tests:', error);
  process.exit(1);
}