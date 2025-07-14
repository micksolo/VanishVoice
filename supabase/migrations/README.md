# Supabase Migrations

This directory contains SQL migrations for the VanishVoice database schema.

## Running Migrations

To apply these migrations to your Supabase database:

1. **Using Supabase CLI (Recommended)**:
   ```bash
   supabase db push
   ```

2. **Manual Application**:
   - Go to your Supabase Dashboard
   - Navigate to SQL Editor
   - Copy and paste the contents of each migration file
   - Execute the SQL

## Migration Files

### 20250114_create_friend_keys_table.sql
Creates the `friend_keys` table needed for E2E encryption between friends. This table stores public keys exchanged between friends for secure messaging.

**Important**: This migration must be run if you're seeing errors like:
- "relation 'friend_keys' does not exist"
- "ERROR [FriendEncryption] Error sharing public key"

The app will continue to work with local encryption even if this table doesn't exist, but key exchange between devices won't work until the migration is applied.