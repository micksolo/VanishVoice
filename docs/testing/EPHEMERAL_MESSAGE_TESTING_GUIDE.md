# Ephemeral Message Auto-Delete Testing Guide

This guide provides step-by-step instructions for testing the ephemeral message auto-delete feature locally, including database setup, edge function testing, and debugging tips.

## Table of Contents
1. [Overview](#overview)
2. [Setting Up Your Local Environment](#setting-up-your-local-environment)
3. [Applying Database Migrations](#applying-database-migrations)
4. [Testing Edge Functions Locally](#testing-edge-functions-locally)
5. [Manual Testing Scenarios](#manual-testing-scenarios)
6. [Debugging and Verification](#debugging-and-verification)
7. [Common Issues and Solutions](#common-issues-and-solutions)

## Overview

The ephemeral message system supports multiple expiry types:
- **View-once**: Messages expire immediately after being viewed
- **Read-once**: Text messages expire after being read
- **Playback-once**: Voice/video messages expire after being played
- **Time-based**: Messages expire after a specified duration (e.g., 1 hour)
- **None**: Messages never expire

The system uses:
- Database functions for expiry logic
- Edge functions for cleanup jobs
- Soft deletion (marking as expired) before hard deletion
- Deletion logging for audit trail

## Setting Up Your Local Environment

### 1. Install Supabase CLI
```bash
# macOS
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase
```

### 2. Start Supabase Locally
```bash
# In your project root
supabase start

# This will start:
# - PostgreSQL database on port 54322
# - API server on port 54321
# - Studio UI on port 54323
```

### 3. Get Database Connection Info
```bash
# View connection details
supabase status

# You'll see:
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# API URL: http://localhost:54321
# Studio URL: http://localhost:54323
```

## Applying Database Migrations

### 1. Check Migration Status
```bash
# List all migrations
supabase migration list

# You should see:
# - 20250125_add_ephemeral_messaging.sql
# - 20250127_add_deletion_log.sql
# - 20250127_setup_cron_job.sql
```

### 2. Apply Migrations
```bash
# Apply all pending migrations
supabase db reset

# Or apply specific migration
supabase migration up --include 20250125_add_ephemeral_messaging.sql
```

### 3. Verify Migration Success
Open Supabase Studio (http://localhost:54323) and check:
- `messages` table has `viewed_at` and `is_expired` columns
- `deletion_log` table exists
- Functions `mark_message_viewed`, `delete_expired_messages`, and `check_message_expired` exist

## Testing Edge Functions Locally

### 1. Start Edge Functions
```bash
# In a new terminal, start edge functions runtime
supabase functions serve

# This starts the Deno runtime on port 54321/functions/v1
```

### 2. Test the Expire Messages Function
```bash
# Invoke the function directly
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/expire-messages' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'

# Expected response:
# {
#   "success": true,
#   "deleted_count": 0,
#   "log_entries": 0,
#   "newly_expired": 0,
#   "media_deleted": 0,
#   "timestamp": "2025-01-27T..."
# }
```

### 3. Create a Test Cron Job
For local testing, you can use a simple script to call the function periodically:

```bash
# Create test-cron.sh
#!/bin/bash
while true; do
  echo "Running expiry check at $(date)"
  curl -s -X POST http://localhost:54321/functions/v1/expire-messages \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -H "Content-Type: application/json" | jq '.'
  sleep 60  # Run every minute
done

# Make it executable and run
chmod +x test-cron.sh
./test-cron.sh
```

## Manual Testing Scenarios

### Scenario 1: View-Once Message
```sql
-- Connect to local database
psql postgresql://postgres:postgres@localhost:54322/postgres

-- Create test users
INSERT INTO users (id, anon_id, created_at) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'sender_test', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'recipient_test', NOW());

-- Create a view-once message
INSERT INTO messages (
  id, sender_id, recipient_id, type, content, 
  expiry_rule, created_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'text',
  'This message will disappear after viewing',
  '{"type": "view"}'::jsonb,
  NOW()
);

-- Check message status
SELECT id, viewed_at, expired, is_expired FROM messages WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Simulate viewing the message (as recipient)
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222"}';
SELECT mark_message_viewed('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Check status again - should show viewed_at and expired = true
SELECT id, viewed_at, expired, is_expired FROM messages WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
```

### Scenario 2: Time-Based Expiry (5 seconds)
```sql
-- Create a message that expires in 5 seconds
INSERT INTO messages (
  id, sender_id, recipient_id, type, content, 
  expiry_rule, created_at
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'text',
  'This message expires in 5 seconds',
  '{"type": "time", "duration_sec": 5}'::jsonb,
  NOW()
);

-- Check immediately - should not be expired
SELECT id, expired, is_expired FROM messages WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Wait 6 seconds, then check again
SELECT pg_sleep(6);
SELECT id, expired, is_expired FROM messages WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- is_expired should be true (computed column)

-- Run the cleanup function
SELECT delete_expired_messages();

-- Check deletion log
SELECT * FROM deletion_log WHERE message_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
```

### Scenario 3: Voice Message with Playback-Once
```sql
-- Create a voice message with media
INSERT INTO messages (
  id, sender_id, recipient_id, type, 
  media_path, duration, expiry_rule, created_at
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'voice',
  'audio/11111111-1111-1111-1111-111111111111/test-voice.mp4',
  15.5,
  '{"type": "playback"}'::jsonb,
  NOW()
);

-- Simulate playback
UPDATE messages 
SET listened_at = NOW() 
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Check if marked for expiry
SELECT id, listened_at, expired, is_expired 
FROM messages 
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Run cleanup
SELECT delete_expired_messages();
```

### Scenario 4: Testing the Full Flow via API
```javascript
// test-ephemeral.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'http://localhost:54321',
  'YOUR_ANON_KEY'
);

async function testEphemeralMessage() {
  // Create a test message
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      sender_id: '11111111-1111-1111-1111-111111111111',
      recipient_id: '22222222-2222-2222-2222-222222222222',
      type: 'text',
      content: 'Test ephemeral message',
      expiry_rule: { type: 'view' }
    })
    .select()
    .single();

  console.log('Created message:', message.id);

  // Mark as viewed
  const { data: viewed } = await supabase
    .rpc('mark_message_viewed', { message_id: message.id });

  console.log('Marked as viewed:', viewed);

  // Check if expired
  const { data: check } = await supabase
    .from('messages')
    .select('expired, is_expired')
    .eq('id', message.id)
    .single();

  console.log('Message status:', check);
}

testEphemeralMessage();
```

## Debugging and Verification

### 1. Monitor Database Logs
```bash
# View Postgres logs
supabase db logs

# Or connect and enable detailed logging
psql postgresql://postgres:postgres@localhost:54322/postgres
SET log_statement = 'all';
```

### 2. Check Deletion Log
```sql
-- View all deletions
SELECT * FROM deletion_log ORDER BY deleted_at DESC;

-- View deletion statistics
SELECT * FROM deletion_statistics;

-- Check deletions for specific user
SELECT * FROM get_deletion_stats('11111111-1111-1111-1111-111111111111');
```

### 3. Verify Media Cleanup
```bash
# Check storage buckets
curl http://localhost:54321/storage/v1/bucket/audio/list \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

# Monitor edge function logs
supabase functions logs expire-messages
```

### 4. Test Edge Function Locally with Logging
```typescript
// Add to edge function for debugging
console.log('Messages to delete:', messagesToDelete);
console.log('Media paths:', messagesToDelete?.map(m => m.media_path));
console.log('Deletion result:', result);
```

### 5. SQL Queries for Verification
```sql
-- Find all expired messages
SELECT id, type, expiry_rule, created_at, viewed_at, expired, is_expired 
FROM messages 
WHERE expired = true OR is_expired = true;

-- Find messages that should be deleted
SELECT id, type, expiry_rule, created_at, viewed_at 
FROM messages 
WHERE expired = true 
  AND (
    viewed_at < NOW() - INTERVAL '24 hours'
    OR created_at < NOW() - INTERVAL '48 hours'
  );

-- Check function execution
SELECT delete_expired_messages();

-- View function definition
\df+ check_message_expired
\df+ mark_message_viewed
\df+ delete_expired_messages
```

## Common Issues and Solutions

### Issue 1: Migrations Not Applied
**Symptom**: Missing columns or functions
```bash
# Reset database and reapply all migrations
supabase db reset

# Or check migration status
supabase migration list
```

### Issue 2: Edge Function Not Running
**Symptom**: No cleanup happening
```bash
# Check if functions are running
supabase functions list

# Restart functions
supabase functions serve --no-verify-jwt

# Check function logs
supabase functions logs expire-messages --tail
```

### Issue 3: Messages Not Expiring
**Symptom**: is_expired shows false when it should be true
```sql
-- Manually check expiry logic
SELECT 
  id,
  expiry_rule,
  created_at,
  viewed_at,
  check_message_expired(expiry_rule, created_at, viewed_at, listened_at, read_at) as should_expire,
  is_expired
FROM messages
WHERE id = 'YOUR_MESSAGE_ID';
```

### Issue 4: Permission Errors
**Symptom**: RLS blocking operations
```sql
-- Test as service role (bypasses RLS)
SET LOCAL role TO 'service_role';
SELECT delete_expired_messages();

-- Or disable RLS temporarily for testing
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
-- Remember to re-enable after testing!
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
```

### Issue 5: Media Not Being Deleted
**Symptom**: Storage files remain after message deletion
```javascript
// Test storage deletion directly
const { error } = await supabase.storage
  .from('audio')
  .remove(['path/to/file.mp4']);

console.log('Storage deletion error:', error);
```

## Testing Checklist

- [ ] Database migrations applied successfully
- [ ] Edge functions running locally
- [ ] View-once messages expire after viewing
- [ ] Time-based messages expire after duration
- [ ] Playback-once messages expire after playing
- [ ] Deletion log records all deletions
- [ ] Media files are removed from storage
- [ ] Hard deletion occurs after 24 hours
- [ ] RLS policies work correctly
- [ ] Edge function can be invoked manually
- [ ] Cron job simulation works

## Production Deployment Notes

1. **Enable pg_cron** in Supabase dashboard under Database > Extensions
2. **Deploy edge functions**: `supabase functions deploy expire-messages`
3. **Set up external cron** if pg_cron unavailable (cron-job.org, EasyCron)
4. **Monitor deletion logs** regularly
5. **Set up alerts** for failed cleanup jobs
6. **Test in staging** environment first

## Helpful Resources

- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Database Functions](https://supabase.com/docs/guides/database/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)