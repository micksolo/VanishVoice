-- Add support for text messages in the messages table

-- Add message type enum
CREATE TYPE message_type AS ENUM ('text', 'voice', 'video');

-- Add new columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS type message_type DEFAULT 'voice',
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;

-- Update existing messages to have the correct type
UPDATE messages 
SET type = 'voice' 
WHERE media_path IS NOT NULL AND type IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- Update RLS policies to handle text messages
-- Drop existing policies if they restrict by media_path
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;

-- Create new policies that work for both text and voice messages
CREATE POLICY "Users can insert their own messages" 
ON messages FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id
);

CREATE POLICY "Users can view messages in their conversations" 
ON messages FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
);

-- Add comment for documentation
COMMENT ON COLUMN messages.type IS 'Type of message: text, voice, or video';
COMMENT ON COLUMN messages.content IS 'Text content for text messages, encrypted if is_encrypted is true';
COMMENT ON COLUMN messages.is_encrypted IS 'Whether the message content is encrypted';