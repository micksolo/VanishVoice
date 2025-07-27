-- Add video_nonce column to messages table for fast video decryption
ALTER TABLE messages 
ADD COLUMN video_nonce TEXT;

-- Comment for clarity
COMMENT ON COLUMN messages.video_nonce IS 'Nonce for video encryption using nacl.secretbox - stored separately for fast decryption';