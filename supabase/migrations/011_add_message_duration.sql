-- Add duration column to messages table if it doesn't exist
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Comment on the column
COMMENT ON COLUMN messages.duration IS 'Duration of voice messages in seconds';