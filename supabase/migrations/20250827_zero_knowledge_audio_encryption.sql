-- Migration: Zero-Knowledge Audio Encryption Support
-- This migration adds support for zero-knowledge encrypted audio messages
-- where the server cannot decrypt any audio content.

-- Add new columns for zero-knowledge encryption parameters
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ephemeral_public_key TEXT;

-- Update existing messages to have version 2 (SharedSecretEncryption)
-- This ensures backward compatibility
UPDATE messages 
SET encryption_version = 2 
WHERE encryption_version IS NULL OR encryption_version = 1;

-- Create index for encryption version queries
CREATE INDEX IF NOT EXISTS idx_messages_encryption_version ON messages(encryption_version);

-- Add comment explaining the encryption versions
COMMENT ON COLUMN messages.encryption_version IS 'Encryption version: 1=legacy XOR, 2=SharedSecret XOR, 3+=Zero-Knowledge NaCl';
COMMENT ON COLUMN messages.ephemeral_public_key IS 'Ephemeral public key for zero-knowledge encryption (version 3+)';
COMMENT ON COLUMN messages.encryption_key IS 'For v1-2: encrypted symmetric key, For v3+: data key encrypted with recipient public key';
COMMENT ON COLUMN messages.nonce IS 'For v1-2: audio+key nonces JSON, For v3+: key+data+ephemeral nonces JSON';

-- Update RLS policies to handle new columns (no changes needed - existing policies work)

-- Verify migration
DO $$ 
BEGIN 
    -- Check that columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'encryption_version'
    ) THEN 
        RAISE EXCEPTION 'Migration failed: encryption_version column not created';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'ephemeral_public_key'
    ) THEN 
        RAISE EXCEPTION 'Migration failed: ephemeral_public_key column not created';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully: Zero-knowledge audio encryption support added';
END $$;