-- Verify that friend messages are encrypted in the database
-- Run this in your Supabase SQL editor to check encryption status

-- 1. Show encryption status summary
SELECT 
  COUNT(*) as total_messages,
  SUM(CASE WHEN is_encrypted = true THEN 1 ELSE 0 END) as encrypted_messages,
  SUM(CASE WHEN is_encrypted = false OR is_encrypted IS NULL THEN 1 ELSE 0 END) as unencrypted_messages
FROM messages
WHERE type = 'text';

-- 2. Show a sample of recent messages (without exposing content length)
SELECT 
  id,
  sender_id,
  recipient_id,
  is_encrypted,
  CASE 
    WHEN is_encrypted = true THEN 'ENCRYPTED (' || LENGTH(content) || ' chars)'
    ELSE 'PLAIN TEXT - SECURITY RISK!'
  END as content_status,
  CASE 
    WHEN nonce IS NOT NULL THEN 'Has nonce ✓'
    ELSE 'No nonce ✗'
  END as nonce_status,
  created_at
FROM messages
WHERE type = 'text'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if any messages are unencrypted (security audit)
SELECT 
  id,
  sender_id,
  recipient_id,
  LEFT(content, 50) as content_preview,
  created_at
FROM messages
WHERE type = 'text'
  AND (is_encrypted = false OR is_encrypted IS NULL)
ORDER BY created_at DESC;

-- If the last query returns no rows, all your messages are encrypted! 🔐