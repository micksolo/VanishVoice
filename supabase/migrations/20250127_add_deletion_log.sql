-- Create deletion log table for audit trail
CREATE TABLE IF NOT EXISTS deletion_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  message_type TEXT NOT NULL,
  expiry_type TEXT NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deletion_reason TEXT,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Add indexes for efficient querying
CREATE INDEX idx_deletion_log_deleted_at ON deletion_log(deleted_at);
CREATE INDEX idx_deletion_log_sender_id ON deletion_log(sender_id);
CREATE INDEX idx_deletion_log_recipient_id ON deletion_log(recipient_id);

-- RLS policies for deletion log (read-only for users)
ALTER TABLE deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deletion logs" ON deletion_log
  FOR SELECT USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
  );

-- Create a function to handle message deletion with logging
CREATE OR REPLACE FUNCTION delete_expired_messages()
RETURNS TABLE(deleted_count INTEGER, log_entries INTEGER) AS $$
DECLARE
  deleted_messages INTEGER := 0;
  logged_entries INTEGER := 0;
  msg RECORD;
BEGIN
  -- Process messages that need immediate deletion after viewing
  FOR msg IN 
    SELECT m.*, u1.anon_id as sender_anon_id, u2.anon_id as recipient_anon_id
    FROM messages m
    JOIN users u1 ON m.sender_id = u1.id
    JOIN users u2 ON m.recipient_id = u2.id
    WHERE NOT m.expired  -- Not already marked as expired
      AND (
        -- View-once messages that have been viewed
        (m.expiry_rule->>'type' = 'view' AND m.viewed_at IS NOT NULL)
        -- Playback-once messages that have been played
        OR (m.expiry_rule->>'type' = 'playback' AND m.listened_at IS NOT NULL)
        -- Read-once messages that have been read
        OR (m.expiry_rule->>'type' = 'read' AND m.read_at IS NOT NULL)
        -- Time-based expiry
        OR (m.expiry_rule->>'type' = 'time' AND 
            NOW() > m.created_at + INTERVAL '1 second' * (m.expiry_rule->>'duration_sec')::INTEGER)
      )
  LOOP
    -- Log the deletion
    INSERT INTO deletion_log (
      message_id,
      sender_id,
      recipient_id,
      message_type,
      expiry_type,
      deletion_reason,
      metadata
    ) VALUES (
      msg.id,
      msg.sender_id,
      msg.recipient_id,
      msg.type,
      msg.expiry_rule->>'type',
      CASE 
        WHEN msg.expiry_rule->>'type' = 'view' THEN 'Viewed at ' || msg.viewed_at::TEXT
        WHEN msg.expiry_rule->>'type' = 'playback' THEN 'Played at ' || msg.listened_at::TEXT
        WHEN msg.expiry_rule->>'type' = 'read' THEN 'Read at ' || msg.read_at::TEXT
        WHEN msg.expiry_rule->>'type' = 'time' THEN 'Time expired'
        ELSE 'Unknown'
      END,
      jsonb_build_object(
        'viewed_at', msg.viewed_at,
        'listened_at', msg.listened_at,
        'read_at', msg.read_at,
        'created_at', msg.created_at,
        'duration', msg.duration
      )
    );
    
    logged_entries := logged_entries + 1;

    -- Delete associated media from storage if exists
    IF msg.media_path IS NOT NULL THEN
      -- This will be handled by the edge function
      NULL;
    END IF;

    -- Mark the message as expired (soft delete first)
    UPDATE messages 
    SET expired = TRUE 
    WHERE id = msg.id;
    
    deleted_messages := deleted_messages + 1;
  END LOOP;

  -- Hard delete messages that have been expired for more than 24 hours
  DELETE FROM messages 
  WHERE expired = TRUE 
    AND (
      (viewed_at IS NOT NULL AND viewed_at < NOW() - INTERVAL '24 hours')
      OR (listened_at IS NOT NULL AND listened_at < NOW() - INTERVAL '24 hours')
      OR (read_at IS NOT NULL AND read_at < NOW() - INTERVAL '24 hours')
      OR (created_at < NOW() - INTERVAL '48 hours') -- Fallback for any expired message
    );

  RETURN QUERY SELECT deleted_messages, logged_entries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role (edge functions)
GRANT EXECUTE ON FUNCTION delete_expired_messages() TO service_role;

-- Create a function to get deletion stats for a user
CREATE OR REPLACE FUNCTION get_deletion_stats(user_id UUID)
RETURNS TABLE(
  total_deleted INTEGER,
  deleted_as_sender INTEGER,
  deleted_as_recipient INTEGER,
  deletion_by_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_deleted,
    COUNT(*) FILTER (WHERE sender_id = user_id)::INTEGER as deleted_as_sender,
    COUNT(*) FILTER (WHERE recipient_id = user_id)::INTEGER as deleted_as_recipient,
    jsonb_object_agg(expiry_type, type_count) as deletion_by_type
  FROM (
    SELECT expiry_type, COUNT(*) as type_count
    FROM deletion_log
    WHERE sender_id = user_id OR recipient_id = user_id
    GROUP BY expiry_type
  ) t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_deletion_stats(UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE deletion_log IS 'Audit trail for deleted ephemeral messages';
COMMENT ON FUNCTION delete_expired_messages IS 'Processes and deletes expired messages with logging';
COMMENT ON FUNCTION get_deletion_stats IS 'Returns deletion statistics for a user';