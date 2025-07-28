-- Enable pg_cron extension for scheduled jobs
-- Note: This requires pg_cron to be enabled in your Supabase project settings

-- First, check if we can enable pg_cron
DO $$
BEGIN
  -- Try to create the extension
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  
  -- If successful, schedule the cleanup job
  PERFORM cron.schedule(
    'delete-expired-messages',
    '*/5 * * * *', -- Every 5 minutes (adjust as needed)
    $$
      -- Call our cleanup function
      SELECT delete_expired_messages();
    $$
  );
  
  RAISE NOTICE 'Cron job scheduled successfully';
  
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_cron extension not available. Please enable it in Supabase dashboard or use an external cron service.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not set up cron job: %', SQLERRM;
END $$;

-- Alternative: Create a function that can be called by external services
CREATE OR REPLACE FUNCTION cleanup_expired_messages_api()
RETURNS jsonb AS $$
DECLARE
  result RECORD;
BEGIN
  -- Call the main cleanup function
  SELECT * INTO result FROM delete_expired_messages();
  
  -- Return result as JSON
  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', result.deleted_count,
    'log_entries', result.log_entries,
    'timestamp', NOW()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role for API access
GRANT EXECUTE ON FUNCTION cleanup_expired_messages_api() TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION cleanup_expired_messages_api() IS 'API endpoint for external cron services to trigger message cleanup';

-- Create a view to monitor deletion statistics
CREATE OR REPLACE VIEW deletion_statistics AS
SELECT 
  COUNT(*) as total_deletions,
  COUNT(DISTINCT sender_id) as unique_senders,
  COUNT(DISTINCT recipient_id) as unique_recipients,
  DATE_TRUNC('hour', deleted_at) as hour,
  jsonb_object_agg(expiry_type, type_count) as deletions_by_type
FROM (
  SELECT 
    sender_id,
    recipient_id,
    expiry_type,
    deleted_at,
    COUNT(*) OVER (PARTITION BY expiry_type) as type_count
  FROM deletion_log
  WHERE deleted_at > NOW() - INTERVAL '24 hours'
) t
GROUP BY DATE_TRUNC('hour', deleted_at)
ORDER BY hour DESC;

-- Grant read access to authenticated users
GRANT SELECT ON deletion_statistics TO authenticated;

COMMENT ON VIEW deletion_statistics IS 'Hourly statistics of message deletions for monitoring';

-- Instructions for manual setup if pg_cron is not available
DO $$
BEGIN
  RAISE NOTICE E'\n\n=== IMPORTANT: Message Cleanup Setup ===\n\n';
  RAISE NOTICE 'If pg_cron is not available, you have several options:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Use Supabase Edge Functions with an external cron service:';
  RAISE NOTICE '   - Deploy the expire-messages edge function';
  RAISE NOTICE '   - Use cron-job.org, EasyCron, or similar to call it every minute';
  RAISE NOTICE '';
  RAISE NOTICE '2. Call the cleanup API directly:';
  RAISE NOTICE '   POST /rest/v1/rpc/cleanup_expired_messages_api';
  RAISE NOTICE '';
  RAISE NOTICE '3. Use Database Webhooks to trigger on message updates';
  RAISE NOTICE '';
  RAISE NOTICE 'For production, we recommend option 1 with a reliable cron service.';
  RAISE NOTICE E'\n=======================================\n';
END $$;