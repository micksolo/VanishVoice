-- Test script for zero-knowledge encryption migration
-- Run this after applying the migration to verify it worked

-- Check if device_public_keys table exists
SELECT 
  'device_public_keys table' as check_type,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'device_public_keys') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status;

-- Check if new columns were added to messages table
SELECT 
  'messages columns' as check_type,
  string_agg(
    column_name || 
    CASE 
      WHEN column_name IN ('encryption_version', 'key_nonce', 'data_nonce', 'ephemeral_public_key') 
      THEN ' ✅' 
      ELSE '' 
    END, 
    ', '
  ) as columns
FROM information_schema.columns 
WHERE table_name = 'messages' 
  AND column_name IN ('encryption_version', 'key_nonce', 'data_nonce', 'ephemeral_public_key');

-- Check if secure_messages view was created
SELECT 
  'secure_messages view' as check_type,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.views WHERE table_name = 'secure_messages') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status;

-- Test the secure_messages view (should run without errors)
SELECT 
  'secure_messages query test' as check_type,
  CASE 
    WHEN (SELECT COUNT(*) FROM secure_messages WHERE false) >= 0 -- Will always be 0 but tests if view works
    THEN '✅ QUERY SUCCESSFUL' 
    ELSE '❌ QUERY FAILED' 
  END as status;

-- Check encryption_audit table
SELECT 
  'encryption_audit table' as check_type,
  CASE 
    WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'encryption_audit') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status;

-- Verify migration marker was inserted
SELECT 
  'migration marker' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT FROM encryption_audit 
      WHERE action = 'zero_knowledge_migration_applied' 
        AND details::text LIKE '%20250826_fixed%'
    )
    THEN '✅ FOUND' 
    ELSE '❌ MISSING' 
  END as status;

-- Show actual columns in messages table for reference
SELECT 
  'messages table structure' as info_type,
  string_agg(column_name, ', ' ORDER BY ordinal_position) as all_columns
FROM information_schema.columns 
WHERE table_name = 'messages';