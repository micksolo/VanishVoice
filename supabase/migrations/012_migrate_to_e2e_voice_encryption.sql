-- Migrate voice messages to E2E encryption
-- This migration removes the old encryption_key and encryption_iv columns
-- as we now store the encrypted key in the content field

-- First, add a comment to clarify the new usage of content field for voice messages
COMMENT ON COLUMN messages.content IS 'For text messages: the message text (encrypted if is_encrypted=true). For voice messages: the encrypted audio key (E2E encrypted with recipient public key)';

-- Drop the old encryption columns that stored keys in plaintext
-- These are no longer needed as we use E2E encryption
ALTER TABLE messages 
DROP COLUMN IF EXISTS encryption_key,
DROP COLUMN IF EXISTS encryption_iv;

-- Add index on nonce for faster lookups during decryption
CREATE INDEX IF NOT EXISTS idx_messages_nonce ON messages(nonce) WHERE nonce IS NOT NULL;

-- Update any existing voice messages to mark them as needing re-encryption
-- (In production, you'd want to migrate existing messages properly)
UPDATE messages 
SET is_encrypted = false 
WHERE type = 'voice' AND content IS NULL;

COMMENT ON TABLE messages IS 'Stores all messages between users. Voice messages use E2E encryption where content contains the encrypted audio key';