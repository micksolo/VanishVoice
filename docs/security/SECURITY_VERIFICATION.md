# Security Verification Guide

## 🔒 E2E Encryption Verification Steps

### 1. Run Automated Tests

From the project root directory:

```bash
node quick_security_test.js
```

This will run:
- Encryption algorithm tests
- Security code audit
- NPM vulnerability scan

### 2. Verify in Supabase Dashboard

Run these SQL queries in your Supabase SQL editor:

```sql
-- Check encryption versions
SELECT 
  encryption_version, 
  COUNT(*) as message_count 
FROM messages 
GROUP BY encryption_version;

-- Verify all new messages use NaCl (version 3)
SELECT 
  id, 
  created_at, 
  encryption_version,
  media_path
FROM messages 
ORDER BY created_at DESC 
LIMIT 10;

-- Check user keys are synced
SELECT 
  id, 
  public_key IS NOT NULL as has_public_key,
  key_generated_at,
  encryption_version
FROM users
WHERE encryption_version = 3;

-- Verify encrypted content in storage
-- Check that voice files in Supabase Storage are binary/encrypted
-- They should NOT be playable directly from the dashboard
```

### 3. Device-to-Device Test

1. **Send a message from Device A to Device B**
2. **Check Supabase Storage**: The audio file should be encrypted (not playable)
3. **Check messages table**: Should show `encryption_version = 3`
4. **Receive on Device B**: Should decrypt and play successfully
5. **Try with wrong recipient**: Should fail to decrypt

### 4. Security Checklist

- [x] **NaCl Encryption**: Using TweetNaCl with Curve25519 + XSalsa20-Poly1305
- [x] **Perfect Forward Secrecy**: Each message has unique ephemeral keys
- [x] **Key Storage**: Using platform keychains (iOS Keychain / Android Keystore)
- [x] **No Hardcoded Secrets**: All keys generated on-device
- [x] **Authenticated Encryption**: Poly1305 prevents tampering
- [x] **Secure Random**: Using crypto.getRandomValues()
- [x] **Key Sync**: Public keys stored in database for message exchange
- [x] **Version Migration**: Supports upgrading from old XOR to NaCl

### 5. Known Security Features

1. **End-to-End Encryption**: Messages encrypted on sender's device, decrypted on recipient's device
2. **Zero-Knowledge Server**: Supabase stores only encrypted data
3. **Message Expiry**: Automatic deletion based on time/location/event rules
4. **Mutual Save**: Both parties must consent to save messages permanently
5. **Anonymous Mode**: Support for random connections without exposing identity

### 6. Testing Commands

```bash
# Run all tests
npm test

# Run security-specific tests
npm test src/utils/__tests__/e2e_encryption_audit.test.ts

# Check for vulnerabilities
npm audit

# Update dependencies
npm update
```

### 7. What to Look For

✅ **Good Signs**:
- All messages have `encryption_version = 3`
- Audio files in storage are not playable
- Public keys are 44 characters (base64 encoded 32 bytes)
- No secrets in code (only process.env references)

❌ **Warning Signs**:
- Messages with `encryption_version < 3`
- Readable/playable audio in storage
- Hardcoded keys or secrets
- Missing public_key for users

## 📊 Expected Test Results

When running `node quick_security_test.js`, you should see:

1. **Encryption Test**: All 5 tests pass (key generation, encryption, decryption, tampering detection, wrong recipient)
2. **Security Check**: 4/4 security categories pass
3. **NPM Audit**: Ideally 0 vulnerabilities (some dev dependencies may have low-severity issues)

## 🚀 Production Checklist

Before going to production:

1. [ ] Enable Supabase RLS policies
2. [ ] Set up SSL certificates
3. [ ] Configure rate limiting
4. [ ] Enable audit logging
5. [ ] Set up monitoring/alerts
6. [ ] Penetration testing
7. [ ] Security review by expert
8. [ ] Document incident response plan