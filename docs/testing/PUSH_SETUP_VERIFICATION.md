# Push Notification Setup Verification

## Step 1: Check Push Tokens
Run this SQL query in Supabase Dashboard → SQL Editor:
```sql
-- Check push tokens in the push_tokens table
SELECT 
  pt.user_id,
  u.username,
  pt.token,
  pt.platform,
  pt.created_at
FROM push_tokens pt
JOIN users u ON u.id = pt.user_id
ORDER BY pt.created_at DESC;
```

## Step 2: Redeploy the Updated Edge Function
Since we fixed the Edge Function to use the correct table, redeploy it:
```bash
npx supabase functions deploy send-push-notification
```

## Step 3: Test Push Notification Directly
Once you have the user IDs from Step 1, test the Edge Function directly in Supabase Dashboard → SQL Editor:
```sql
-- Get user IDs for testing
SELECT id, username FROM users;
```

Then test the function using curl (replace with actual values):
```bash
curl -X POST https://dhzblvgfexkgkxhhdlpk.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_id": "RECIPIENT_USER_ID",
    "title": "Test Push",
    "body": "This is a test notification",
    "data": {
      "type": "new_message",
      "sender_id": "SENDER_USER_ID"
    }
  }'
```

## Expected Results
From your console logs, these tokens are already saved:
- Device 1: `ExponentPushToken[m_EaUVDlMlA7_5TuMBn6Ex]`
- Device 2: `ExponentPushToken[vy9g35HGLMSEWwlIJSi453]`

## Next Steps
1. Verify tokens are in the database
2. Redeploy the Edge Function
3. Test sending a message between devices
4. Check Edge Function logs for any errors