# Debug NaCl Decryption Issue

## The Problem
Messages encrypt successfully but fail to decrypt with "invalid ciphertext or keys"

## What's Happening

### During Encryption:
1. Generate ephemeral key pair
2. Use: ephemeral SECRET key + recipient PUBLIC key
3. Store: ephemeral PUBLIC key in database

### During Decryption:
1. Retrieve ephemeral PUBLIC key from database
2. Use: recipient SECRET key + ephemeral PUBLIC key
3. This should work with NaCl box

## Debug Steps

1. **Rebuild with debug logging**:
   ```bash
   npx expo run:ios --device
   ```

2. **Send a test message** and note in logs:
   - Recipient public key length (should be 44)
   - Ephemeral public key length (should be 44)
   - Nonce length (should be 32)

3. **Try to play message** and note in logs:
   - Storage path
   - Nonce length (should be 32)
   - Ephemeral public key length (should be 44)
   - Recipient secret key length (should be 44)

## Possible Issues

1. **Key Format Mismatch**
   - Base64 encoding issues
   - Keys being double-encoded

2. **Wrong Keys Being Used**
   - Sender's keys instead of ephemeral keys
   - Public/secret key confusion

3. **Data Corruption**
   - During upload/download
   - Base64 encoding/decoding

## Quick Test

After rebuild, the debug logs will show exactly what's wrong. Look for:
- Null or undefined values
- Mismatched key lengths
- Any encoding errors

The logs will pinpoint the exact issue!