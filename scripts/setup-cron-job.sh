#!/bin/bash

# Script to set up cron job for ephemeral message deletion
# This should be run after deploying the edge function

echo "Setting up cron job for ephemeral message deletion..."

# Get the Supabase project URL and service role key
echo "Please ensure you have your Supabase project URL and service role key ready."
echo ""

# The cron expression for running every minute
CRON_EXPRESSION="* * * * *"

# The edge function URL
EDGE_FUNCTION_NAME="expire-messages"

echo "To set up automatic message deletion, you need to:"
echo ""
echo "1. Go to your Supabase Dashboard"
echo "2. Navigate to Edge Functions"
echo "3. Find the '${EDGE_FUNCTION_NAME}' function"
echo "4. Set up a scheduled job with the following settings:"
echo "   - Schedule: ${CRON_EXPRESSION} (every minute)"
echo "   - Or use a service like cron-job.org or EasyCron"
echo ""
echo "Alternative: Use pg_cron extension in Supabase"
echo ""
echo "Run this SQL in the Supabase SQL Editor:"
echo ""
cat << 'EOF'
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup job to run every minute
SELECT cron.schedule(
  'delete-expired-messages',
  '* * * * *', -- Every minute
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/expire-messages',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- To view scheduled jobs
SELECT * FROM cron.job;

-- To remove the job (if needed)
-- SELECT cron.unschedule('delete-expired-messages');
EOF

echo ""
echo "Note: For production, consider using a more robust solution like:"
echo "- Supabase Database Webhooks"
echo "- External cron service (cron-job.org, EasyCron)"
echo "- Scheduled GitHub Actions"
echo "- Vercel Cron Jobs (if using Vercel)"