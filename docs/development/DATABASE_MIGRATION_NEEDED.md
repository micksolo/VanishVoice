# Database Migration Required! 🚨

## The Error
```
Failed to update public key: Could not find the 'encryption_version' column of 'users' in the schema cache
```

## The Problem
The NaCl encryption code is trying to update a column `encryption_version` in the `users` table that doesn't exist yet.

## Quick Fix (2 Options)

### Option 1: Apply the Migration in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run this SQL:

```sql
-- Add encryption_version column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;

-- Add comment for clarity
COMMENT ON COLUMN users.encryption_version IS 'Tracks encryption version: 1=XOR, 2=Improved, 3=NaCl';

-- Update existing users
UPDATE users SET encryption_version = 1 WHERE encryption_version IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_encryption_version ON users(encryption_version);
```

### Option 2: Temporary Code Fix (Immediate)

If you need it working RIGHT NOW, we can remove the encryption_version update temporarily.

## After Applying the Migration

1. **Restart your app** on the second device
2. You should see:
   - ✅ `[NaClMigration] New NaCl keys generated`
   - ✅ `[NaClMigration] Public key updated in database`
   - ✅ `[NaClMigration] Migration completed successfully`

## Why This Happened

1. The original migration file (`008_add_secure_encryption.sql`) only added `encryption_version` to the `messages` table
2. We forgot to add it to the `users` table
3. The NaCl migration code expects this column to track which encryption version each user is using

## Complete Migration Files

I've created the proper migration at:
`/supabase/migrations/009_add_user_encryption_version.sql`

This adds:
- `encryption_version` column to users table
- Default value of 1 (legacy XOR)
- Index for performance
- Helper function for updating keys

## For Production

Before going to production, ensure ALL migrations are applied:
- `008_add_secure_encryption.sql` - Message encryption fields
- `009_add_user_encryption_version.sql` - User encryption tracking

Your app will work perfectly after applying this migration! 🔐