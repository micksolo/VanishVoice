-- Quick Database Verification for Device Key Exchange
-- Run this to verify the device_public_keys table exists and is properly configured

-- 1. Check if device_public_keys table exists
SELECT 
  table_name,
  table_schema
FROM information_schema.tables 
WHERE table_name = 'device_public_keys';

-- 2. Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'device_public_keys'
ORDER BY ordinal_position;

-- 3. Check constraints and indices
SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'device_public_keys';

-- 4. Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'device_public_keys';

-- 5. Sample any existing device keys (sanitized)
SELECT 
  user_id,
  device_id,
  LENGTH(public_key) as public_key_length,
  created_at,
  updated_at
FROM device_public_keys 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Check if encryption_version column exists in messages table
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('encryption_version', 'key_nonce', 'data_nonce', 'ephemeral_public_key');

-- Expected Results:
-- ✅ device_public_keys table should exist
-- ✅ Should have columns: id, user_id, device_id, public_key, created_at, updated_at
-- ✅ Should have unique constraint on (user_id, device_id)
-- ✅ Should have RLS policies for public read, owner write
-- ✅ messages table should have encryption_version column