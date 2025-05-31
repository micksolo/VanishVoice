-- Add save request functionality
CREATE TABLE save_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved BOOLEAN DEFAULT NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(message_id, requested_by)
);

-- Add indexes for save requests
CREATE INDEX idx_save_requests_message ON save_requests(message_id);
CREATE INDEX idx_save_requests_pending ON save_requests(approved) WHERE approved IS NULL;

-- Enable RLS
ALTER TABLE save_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for save_requests
CREATE POLICY "Message sender can view save requests" ON save_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages 
      WHERE messages.id = save_requests.message_id 
      AND messages.sender_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can create save requests" ON save_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requested_by AND
    EXISTS (
      SELECT 1 FROM messages 
      WHERE messages.id = save_requests.message_id 
      AND messages.recipient_id = auth.uid()
      AND messages.expired = false
    )
  );

CREATE POLICY "Message sender can approve save requests" ON save_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM messages 
      WHERE messages.id = save_requests.message_id 
      AND messages.sender_id = auth.uid()
    )
  );

-- Add metadata to messages table
ALTER TABLE messages 
ADD COLUMN duration_seconds INTEGER,
ADD COLUMN file_size_bytes BIGINT,
ADD COLUMN saved BOOLEAN DEFAULT false;

-- Add composite index for better query performance
CREATE INDEX idx_messages_recipient_expired ON messages(recipient_id, expired) 
WHERE NOT expired;

-- Add index for friend code lookups
CREATE INDEX idx_users_friend_code ON users(friend_code);