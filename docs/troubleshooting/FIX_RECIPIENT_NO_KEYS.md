# Fix: "Recipient does not have encryption keys" Error

## The Problem
When sending a message from Device 2 → Device 1, the app checks if Device 1 has a public key in the database. If Device 1 hasn't synced its keys, this error appears.

## Quick Solutions

### Solution 1: Force Key Sync on Device 1 (Recommended)

On **Device 1** (the one that can't receive messages):

1. **Force close** the VanishVoice app completely
2. **Reopen** the app
3. Watch the logs - you should see:
   - `[NaClMigration] Starting migration`
   - `[NaClMigration] Public key updated in database`

4. **Pull to refresh** on the inbox screen to ensure sync

### Solution 2: Check Database Directly

In your Supabase Dashboard, run this SQL to check Device 1's user:

```sql
-- Find users and their encryption status
SELECT 
  id,
  username,
  friend_code,
  public_key IS NOT NULL as has_public_key,
  encryption_version,
  key_generated_at
FROM users
ORDER BY created_at DESC;
```

If Device 1's user has `has_public_key = false`, that's the issue.

### Solution 3: Manual Key Generation Trigger

If Device 1 isn't generating keys automatically, we can add a manual trigger:

1. On Device 1, go to **Profile** tab
2. **Pull to refresh** (this could trigger key generation)
3. Or **log out and log back in**

### Solution 4: Debug Mode

To see what's happening on Device 1, you can:

1. Connect Device 1 to your Mac
2. Open Console.app
3. Filter for "VanishVoice" or "NaCl"
4. Look for error messages about key generation

## Root Causes

This can happen when:

1. **Device 1 hasn't updated** to the new build with NaCl
2. **Migration failed** due to network issues
3. **Database migration** wasn't applied when Device 1 first launched
4. **Race condition** - Device 1 generated keys but hasn't synced yet

## Permanent Fix

Add retry logic for key generation. In the app initialization:

```javascript
// Check and ensure keys are synced
const ensureKeysAreSynced = async () => {
  const { data: userData } = await supabase
    .from('users')
    .select('public_key')
    .eq('id', user.id)
    .single();
    
  if (!userData?.public_key && userKeys?.publicKey) {
    // Local keys exist but not in database - resync
    await syncPublicKeyToDatabase();
  }
};
```

## Testing Between Devices

After fixing:

1. Device 1 → Device 2: Should work
2. Device 2 → Device 1: Should work
3. Check encryption version in logs:
   - v3 = NaCl (best)
   - v2 = Secure (good)
   - v1 = Legacy (works but insecure)

## Prevention

For future devices:
1. Always ensure latest build
2. Check logs during first launch
3. Verify public key exists in database
4. Test bidirectional messaging

Your messages should work after Device 1's keys are synced! 🔐