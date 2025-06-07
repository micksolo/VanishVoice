# Push Notifications Troubleshooting Guide

## Current Issue: Edge Function Non-2xx Status Code

When sending a message, you're seeing:
```
ERROR Failed to send push notification: [FunctionsHttpError: Edge Function returned a non-2xx status code]
```

## Debugging Steps

### 1. Check Edge Function Logs
Go to your Supabase dashboard:
1. Navigate to Functions → send-push-notification
2. Click on "Logs" tab
3. Look for any error messages when the function is invoked

### 2. Verify Push Tokens Are Saved
Check if push tokens are being stored in the database:
```sql
-- Run this in Supabase SQL Editor
SELECT * FROM push_tokens;
```

If no tokens are present:
- Ensure you're testing on physical devices
- Check that notification permissions were granted
- Look for "Push token:" logs in the console

### 3. Test Edge Function Directly
You can test the edge function using curl:
```bash
curl -X POST https://dhzblvgfexkgkxhhdlpk.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "RECIPIENT_USER_ID",
    "senderId": "SENDER_USER_ID",
    "senderName": "Test User",
    "messageId": "test-message-id"
  }'
```

### 4. Common Issues and Solutions

#### Issue: 401 Unauthorized
- **Cause**: Missing or invalid Authorization header
- **Solution**: Ensure the edge function is being called with proper authentication

#### Issue: No push tokens found
- **Cause**: Recipient hasn't registered for push notifications
- **Solution**: 
  1. Have the recipient open the app
  2. Grant notification permissions
  3. Check that their token is saved in the database

#### Issue: Expo Push Service Error
- **Cause**: Invalid push token format
- **Solution**: Ensure tokens start with "ExponentPushToken["

### 5. Enable Detailed Logging
Add more console logs to track the flow:

1. In `AnonymousAuthContext.tsx`, after token registration:
```javascript
console.log('Push notification registration result:', token);
```

2. In the edge function, add logs at each step:
```javascript
console.log('Received request:', { recipientId, senderId, senderName, messageId });
console.log('Found tokens:', pushTokens);
console.log('Expo response:', response.status, result);
```

### 6. Check Function Deployment
Verify the function is properly deployed:
1. Go to Supabase Dashboard → Functions
2. Check that "send-push-notification" is listed and Active
3. Check the "Version" to ensure latest code is deployed

## Next Steps if Issue Persists

1. **Check Supabase Status**: Visit status.supabase.com
2. **Review Function Code**: Ensure the function code matches what's in the repo
3. **Test with Postman**: Use Postman to test the edge function with detailed request/response inspection
4. **Contact Support**: If all else fails, contact Supabase support with:
   - Project ID: dhzblvgfexkgkxhhdlpk
   - Function name: send-push-notification
   - Error logs from both client and edge function

## Temporary Workaround
If push notifications continue to fail, you can comment out the push notification code temporarily:
```javascript
// In EphemeralInboxScreen.tsx, comment out lines 341-369
```

This will allow the app to function normally while we debug the push notification issue.