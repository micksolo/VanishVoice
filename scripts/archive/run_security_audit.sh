#!/bin/bash

echo "🔒 VanishVoice Security Audit"
echo "============================"
echo ""

# Change to project directory
cd /Users/mick/Documents/GitHub/VanishVoice

# Run encryption test
echo "1. Running Encryption Test..."
echo "-----------------------------"
node scripts/test_encryption.js
echo ""

# Run security check
echo "2. Running Security Check..."
echo "----------------------------"
node scripts/security_check.js
echo ""

# Run npm audit
echo "3. Running NPM Audit..."
echo "----------------------"
cd VanishVoice && npm audit || true
echo ""

# Check Supabase logs (if user wants to check manually)
echo "4. Manual Checks Needed:"
echo "-----------------------"
echo "✓ Check Supabase logs for any unencrypted data"
echo "✓ Verify messages table shows encryption_version = 3"
echo "✓ Test between real devices to confirm E2E encryption"
echo ""

echo "🎉 Security audit complete!"