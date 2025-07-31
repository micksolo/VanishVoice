-- Fix time-based expiry filtering issue
-- The problem: RLS policy was filtering messages using computed is_expired column
-- This prevented showing countdown timers for time-based expiry messages
-- Solution: Remove is_expired filtering from RLS, handle expiry in application layer

-- Drop the existing RLS policies that filter by is_expired
DROP POLICY IF EXISTS "Users can view non-expired messages they sent or received" ON messages;
DROP POLICY IF EXISTS "Users can view expired messages they sent or received for cleanup" ON messages;

-- Recreate policies WITHOUT is_expired filtering
-- Messages should be visible to show countdown timers, filtering happens in app layer
CREATE POLICY "Users can view messages they sent or received" ON messages
  FOR SELECT USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
  );

-- Keep the computed column for reference but don't use it in RLS
-- This allows the application to still check expiry status if needed
COMMENT ON COLUMN messages.is_expired IS 'Computed column for expiry status - NOT used in RLS filtering to allow countdown timers';

-- Update the active_messages view to be more explicit about its purpose
DROP VIEW IF EXISTS active_messages;
CREATE VIEW active_messages AS
SELECT * FROM messages 
WHERE expired = false  -- Only filter by static expired column, not computed is_expired
ORDER BY created_at DESC;

COMMENT ON VIEW active_messages IS 'Messages that have not been hard-deleted (expired=true). Time-based expiry handled in application layer.';

-- Grant access to the updated view
GRANT SELECT ON active_messages TO authenticated;