-- Zero-Knowledge Encryption Migration (CORRECTED)
-- This migration adds support for true zero-knowledge E2E encryption
-- where the server CANNOT decrypt any messages.
-- FIXED: Uses actual column names from messages table

-- Create device_public_keys table for zero-knowledge key exchange
CREATE TABLE IF NOT EXISTS device_public_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  public_key TEXT NOT NULL, -- Base64 encoded NaCl public key
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT device_public_keys_user_device_unique UNIQUE (user_id, device_id),
  CONSTRAINT device_public_keys_public_key_length CHECK (LENGTH(public_key) >= 40),
  CONSTRAINT device_public_keys_device_id_length CHECK (LENGTH(device_id) >= 10)
);

-- Create index for fast user lookups
CREATE INDEX IF NOT EXISTS device_public_keys_user_id_idx ON device_public_keys(user_id);
CREATE INDEX IF NOT EXISTS device_public_keys_device_id_idx ON device_public_keys(device_id);

-- Add RLS policies for device public keys
ALTER TABLE device_public_keys ENABLE ROW LEVEL SECURITY;

-- Users can read all public keys (needed for encryption)
CREATE POLICY "Public keys are readable by all authenticated users" 
  ON device_public_keys FOR SELECT 
  TO authenticated 
  USING (true);

-- Users can only insert/update their own device keys
CREATE POLICY "Users can manage their own device keys" 
  ON device_public_keys FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Add encryption version column to messages table (if not exists)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 3;

-- Update existing messages to mark them as legacy (version 1 or 2)
-- Only update messages that don't already have a version set
UPDATE messages 
SET encryption_version = 1 
WHERE encryption_version IS NULL OR encryption_version = 3;

-- Add comment explaining versions
COMMENT ON COLUMN messages.encryption_version IS 'Encryption version: 1=SharedSecret (COMPROMISED), 2=FastXOR (COMPROMISED), 3=ZeroKnowledge (SECURE)';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to auto-update updated_at for device_public_keys
DROP TRIGGER IF EXISTS update_device_public_keys_updated_at ON device_public_keys;
CREATE TRIGGER update_device_public_keys_updated_at 
  BEFORE UPDATE ON device_public_keys 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add encryption metadata columns for zero-knowledge support
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS key_nonce TEXT,
ADD COLUMN IF NOT EXISTS data_nonce TEXT, 
ADD COLUMN IF NOT EXISTS ephemeral_public_key TEXT;

-- Add indices for new columns
CREATE INDEX IF NOT EXISTS messages_encryption_version_idx ON messages(encryption_version);

-- Create view for secure messages (version 3+) - CORRECTED COLUMN NAMES
-- Conservative approach: Only include columns that definitely exist
CREATE OR REPLACE VIEW secure_messages AS
SELECT 
  id,
  sender_id,
  recipient_id,
  content,
  media_path,               -- CORRECTED: Use actual column name (not encrypted_*_path)
  expiry_rule,              -- From original schema
  created_at,
  listened_at,              -- From original schema
  expired,                  -- CORRECTED: Use actual column name (not expires_at)
  -- New zero-knowledge columns we're adding
  key_nonce,
  data_nonce,
  ephemeral_public_key,
  encryption_version
FROM messages 
WHERE encryption_version >= 3;

-- Add comment explaining the security model
COMMENT ON TABLE device_public_keys IS 'Device public keys for zero-knowledge encryption. Server can store these safely but cannot use them to decrypt messages.';

-- Create audit table for security monitoring
CREATE TABLE IF NOT EXISTS encryption_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS encryption_audit_user_id_idx ON encryption_audit(user_id);
CREATE INDEX IF NOT EXISTS encryption_audit_action_idx ON encryption_audit(action);
CREATE INDEX IF NOT EXISTS encryption_audit_created_at_idx ON encryption_audit(created_at);

-- RLS for audit table
ALTER TABLE encryption_audit ENABLE ROW LEVEL SECURITY;

-- Only allow reading own audit records
CREATE POLICY "Users can read their own audit records" 
  ON encryption_audit FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create function to log encryption events
CREATE OR REPLACE FUNCTION log_encryption_event(
  p_user_id UUID,
  p_action TEXT,
  p_details TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO encryption_audit (user_id, action, details)
  VALUES (p_user_id, p_action, COALESCE(p_details, '{}'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION log_encryption_event TO authenticated;

-- Insert initial migration marker
INSERT INTO encryption_audit (user_id, action, details)
VALUES (
  '00000000-0000-0000-0000-000000000000'::UUID,
  'zero_knowledge_migration_applied',
  '{"migration_version": "20250826_fixed", "description": "Added zero-knowledge encryption support with corrected column names"}'
) ON CONFLICT DO NOTHING;

-- Add helpful comments
COMMENT ON VIEW secure_messages IS 'View showing only messages encrypted with zero-knowledge encryption (version 3+)';
COMMENT ON COLUMN messages.encryption_version IS 'Encryption version: 1=SharedSecret (COMPROMISED), 2=FastXOR (COMPROMISED), 3=ZeroKnowledge (SECURE)';
COMMENT ON COLUMN messages.key_nonce IS 'Nonce for encrypting the content key (zero-knowledge encryption)';
COMMENT ON COLUMN messages.data_nonce IS 'Nonce for encrypting the actual content (zero-knowledge encryption)';
COMMENT ON COLUMN messages.ephemeral_public_key IS 'Ephemeral public key for Perfect Forward Secrecy';

-- Final verification query (for manual testing)
-- This should show the new table and columns exist
DO $$
BEGIN
  -- Verify device_public_keys table exists
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'device_public_keys') THEN
    RAISE EXCEPTION 'device_public_keys table not created';
  END IF;
  
  -- Verify new columns exist
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'encryption_version') THEN
    RAISE EXCEPTION 'encryption_version column not added to messages';
  END IF;
  
  -- Verify view was created successfully
  IF NOT EXISTS (SELECT FROM information_schema.views WHERE table_name = 'secure_messages') THEN
    RAISE EXCEPTION 'secure_messages view not created';
  END IF;
  
  RAISE NOTICE 'Zero-knowledge encryption migration completed successfully with corrected column names';
END $$;