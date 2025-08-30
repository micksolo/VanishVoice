# Database Migrations Required

## Status: PENDING - Manual Application Required

The following database migrations need to be applied to the VanishVoice production database to enable zero-knowledge encryption:

### Migration 1: Zero-Knowledge Audio Encryption Support
**File**: `supabase/migrations/20250827_zero_knowledge_audio_encryption.sql`

**Purpose**: Adds support for zero-knowledge encrypted audio messages where the server cannot decrypt any content.

**Changes**:
- Adds `encryption_version` column to track encryption method (1=legacy, 2=SharedSecret, 3+=Zero-Knowledge)
- Adds `ephemeral_public_key` column for NaCl encryption
- Updates existing messages to version 2 for backward compatibility
- Adds indexes and documentation

### Migration 2: MITM Protection and Key Verification
**File**: `supabase/migrations/20250827_add_key_verification.sql`

**Purpose**: Enables tracking verification status and detecting potential MITM attacks in anonymous chat.

**Changes**:
- Adds verification fields to `key_exchange` table
- Creates `verification_logs` table for security monitoring
- Adds RLS policies for verification logs
- Creates function to log verification events

## Manual Application Steps

### Option 1: Supabase Dashboard SQL Editor
1. Go to https://supabase.com/dashboard/project/dhzblvgfexkgkxhhdlpk/sql
2. Copy and paste the contents of each migration file
3. Execute each migration separately
4. Verify successful execution

### Option 2: psql Command Line (if connectivity issues resolved)
```bash
# Install PostgreSQL client if needed
brew install postgresql

# Apply audio encryption migration
psql [DATABASE_URL] -f supabase/migrations/20250827_zero_knowledge_audio_encryption.sql

# Apply key verification migration  
psql [DATABASE_URL] -f supabase/migrations/20250827_add_key_verification.sql
```

### Option 3: Supabase CLI (if linking issues resolved)
```bash
# Link to project
npx supabase link --project-ref dhzblvgfexkgkxhhdlpk

# Apply migrations
npx supabase db push
```

## Verification

After applying migrations, verify:
1. New columns exist in `messages` table
2. New `verification_logs` table exists
3. Indexes are created properly
4. RLS policies are active
5. Functions are executable

## Impact

Without these migrations:
- Zero-knowledge audio/video encryption will fail
- MITM protection won't work in anonymous chat
- App may crash when trying to use new encryption features
- Security verification tests will fail

## Priority: HIGH
These migrations are required before the zero-knowledge encryption system can function properly in production.