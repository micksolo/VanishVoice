-- Add ephemeral messaging support to messages table
-- This migration adds the viewed_at field and updates expiry rule types

-- Add viewed_at timestamp for tracking when message was first viewed
ALTER TABLE messages 
ADD COLUMN viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index on viewed_at for efficient expiry queries
CREATE INDEX idx_messages_viewed_at ON messages(viewed_at) WHERE viewed_at IS NOT NULL;

-- Add index on expiry_rule for efficient expiry processing
CREATE INDEX idx_messages_expiry_rule ON messages USING GIN(expiry_rule);

-- Update the expiry rule check function to handle new view-based expiry
CREATE OR REPLACE FUNCTION check_message_expired(
  msg_expiry_rule JSONB,
  msg_created_at TIMESTAMP WITH TIME ZONE,
  msg_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  msg_listened_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  msg_read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- No expiry rule means never expires
  IF msg_expiry_rule IS NULL OR msg_expiry_rule->>'type' = 'none' THEN
    RETURN FALSE;
  END IF;

  -- View-once expiry: expires immediately after being viewed
  IF msg_expiry_rule->>'type' = 'view' THEN
    RETURN msg_viewed_at IS NOT NULL;
  END IF;

  -- Time-based expiry: expires after duration_sec seconds from creation
  IF msg_expiry_rule->>'type' = 'time' THEN
    RETURN NOW() > msg_created_at + INTERVAL '1 second' * (msg_expiry_rule->>'duration_sec')::INTEGER;
  END IF;

  -- Playback expiry: expires after first playback (for voice/video)
  IF msg_expiry_rule->>'type' = 'playback' THEN
    RETURN msg_listened_at IS NOT NULL;
  END IF;

  -- Read expiry: expires after first read (for text)
  IF msg_expiry_rule->>'type' = 'read' THEN
    RETURN msg_read_at IS NOT NULL;
  END IF;

  -- Location-based expiry (future feature)
  IF msg_expiry_rule->>'type' = 'location' THEN
    -- For now, location-based expiry is not implemented
    RETURN FALSE;
  END IF;

  -- Event-based expiry (future feature)
  IF msg_expiry_rule->>'type' = 'event' THEN
    -- For now, event-based expiry is not implemented
    RETURN FALSE;
  END IF;

  -- Default: no expiry
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Add a computed column to easily check if message is expired
ALTER TABLE messages 
ADD COLUMN is_expired BOOLEAN GENERATED ALWAYS AS (
  check_message_expired(expiry_rule, created_at, viewed_at, listened_at, read_at)
) STORED;

-- Create index on is_expired for efficient filtering
CREATE INDEX idx_messages_is_expired ON messages(is_expired);

-- Update RLS policies to exclude expired messages from normal queries
-- First drop existing policies
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- Recreate policies with expiry filtering
CREATE POLICY "Users can view non-expired messages they sent or received" ON messages
  FOR SELECT USING (
    (sender_id = auth.uid() OR recipient_id = auth.uid()) 
    AND NOT is_expired
  );

CREATE POLICY "Users can view expired messages they sent or received for cleanup" ON messages
  FOR SELECT USING (
    (sender_id = auth.uid() OR recipient_id = auth.uid())
    -- Allow viewing expired messages for cleanup purposes
  );

CREATE POLICY "Users can insert their own messages" ON messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update messages they sent or received" ON messages
  FOR UPDATE USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
  );

-- Create function to mark message as viewed and handle immediate expiry
CREATE OR REPLACE FUNCTION mark_message_viewed(message_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  msg_record RECORD;
  should_expire BOOLEAN := FALSE;
BEGIN
  -- Get the message with current expiry rule
  SELECT * INTO msg_record 
  FROM messages 
  WHERE id = message_id 
    AND (sender_id = auth.uid() OR recipient_id = auth.uid());

  -- Return false if message not found or not accessible
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update viewed_at timestamp
  UPDATE messages 
  SET viewed_at = NOW()
  WHERE id = message_id;

  -- Check if message should expire immediately
  should_expire := check_message_expired(
    msg_record.expiry_rule,
    msg_record.created_at,
    NOW(), -- viewed_at
    msg_record.listened_at,
    msg_record.read_at
  );

  -- If message should expire immediately, mark it as expired
  IF should_expire THEN
    UPDATE messages 
    SET expired = TRUE
    WHERE id = message_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION mark_message_viewed(UUID) TO authenticated;

-- Add helpful comments
COMMENT ON COLUMN messages.viewed_at IS 'Timestamp when message was first viewed (triggers expiry for view-once messages)';
COMMENT ON COLUMN messages.is_expired IS 'Computed column indicating if message has expired based on expiry_rule';
COMMENT ON FUNCTION check_message_expired IS 'Determines if a message has expired based on its expiry rule and timestamps';
COMMENT ON FUNCTION mark_message_viewed IS 'Marks a message as viewed and handles immediate expiry if needed';

-- Create a view for active (non-expired) messages for easier querying
CREATE VIEW active_messages AS
SELECT * FROM messages 
WHERE NOT is_expired 
ORDER BY created_at DESC;

-- Grant access to the view
GRANT SELECT ON active_messages TO authenticated;