#!/usr/bin/env node

/**
 * Security Check Script for VanishVoice
 * Run with: node scripts/security_check.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 VanishVoice Security Check\n');

let issues = 0;

// Check 1: Look for hardcoded secrets
console.log('1. Checking for hardcoded secrets...');
const secretPatterns = [
  /SUPABASE_KEY\s*=\s*["'](?!process\.env)/gi,
  /SECRET\s*=\s*["'](?!process\.env)/gi,
  /PASSWORD\s*=\s*["']\w+["']/gi,
  /API_KEY\s*=\s*["'](?!process\.env)/gi,
  /sk_live_/gi,
  /pk_live_/gi
];

function scanDirectory(dir, patterns) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.includes('node_modules') && !file.startsWith('.')) {
      scanDirectory(fullPath, patterns);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          console.log(`  ⚠️  Found potential secret in ${fullPath}`);
          console.log(`     Pattern: ${pattern}`);
          issues++;
        }
      });
    }
  });
}

scanDirectory('./src', secretPatterns);
console.log(issues > 0 ? `  ❌ Found ${issues} potential issues` : '  ✅ No hardcoded secrets found\n');

// Check 2: Verify encryption is being used
console.log('2. Checking encryption implementation...');
const encryptionChecks = {
  'NaCl import': /import.*nacl.*from.*tweetnacl/,
  'Key generation': /generateKeyPair/,
  'Encryption call': /NaClEncryption\.encrypt/,
  'Decryption call': /NaClEncryption\.decrypt/
};

let encryptionFound = 0;
Object.entries(encryptionChecks).forEach(([name, pattern]) => {
  const srcDir = './src';
  let found = false;
  
  function checkPattern(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.includes('node_modules')) {
        checkPattern(fullPath);
      } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (pattern.test(content)) {
          found = true;
        }
      }
    });
  }
  
  checkPattern(srcDir);
  console.log(`  ${found ? '✅' : '❌'} ${name}`);
  if (found) encryptionFound++;
});

// Check 3: Environment variables
console.log('\n3. Checking environment configuration...');
const envExample = fs.existsSync('.env.example');
const gitignore = fs.existsSync('.gitignore');
let envSecure = true;

console.log(`  ${envExample ? '✅' : '❌'} .env.example exists`);
console.log(`  ${gitignore ? '✅' : '❌'} .gitignore exists`);

if (gitignore) {
  const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
  const hasEnvIgnore = gitignoreContent.includes('.env');
  console.log(`  ${hasEnvIgnore ? '✅' : '❌'} .env is gitignored`);
  if (!hasEnvIgnore) envSecure = false;
}

// Check 4: Dependencies
console.log('\n4. Checking security dependencies...');
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const securityDeps = {
  'tweetnacl': packageJson.dependencies?.tweetnacl,
  'react-native-keychain': packageJson.dependencies?.['react-native-keychain'],
  'react-native-get-random-values': packageJson.dependencies?.['react-native-get-random-values']
};

Object.entries(securityDeps).forEach(([dep, version]) => {
  console.log(`  ${version ? '✅' : '❌'} ${dep}: ${version || 'NOT FOUND'}`);
});

// Summary
console.log('\n📊 Security Check Summary:');
console.log('─'.repeat(30));

const totalChecks = 4;
const passed = (issues === 0 ? 1 : 0) + 
               (encryptionFound === 4 ? 1 : 0) + 
               (envSecure ? 1 : 0) + 
               (Object.values(securityDeps).filter(v => v).length === 3 ? 1 : 0);

console.log(`Total: ${passed}/${totalChecks} security categories passed`);

if (passed === totalChecks) {
  console.log('\n✅ All security checks passed! Your E2E encryption looks good.');
} else {
  console.log('\n⚠️  Some security checks failed. Please review the issues above.');
}

// Additional recommendations
console.log('\n💡 Additional Security Recommendations:');
console.log('1. Run "npm audit" regularly');
console.log('2. Keep dependencies updated');
console.log('3. Test encryption between devices');
console.log('4. Monitor Supabase logs for unencrypted data');
console.log('5. Perform penetration testing before production');