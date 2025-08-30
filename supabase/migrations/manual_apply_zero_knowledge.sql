-- Manual Zero-Knowledge Encryption Setup
-- Apply this manually if automatic migrations fail

-- Step 1: Create device public keys table
CREATE TABLE IF NOT EXISTS device_public_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE (user_id, device_id)
);

-- Step 2: Create basic index
CREATE INDEX IF NOT EXISTS device_public_keys_user_id_idx ON device_public_keys(user_id);

-- Step 3: Enable RLS
ALTER TABLE device_public_keys ENABLE ROW LEVEL SECURITY;

-- Step 4: Add RLS policies
CREATE POLICY "Public keys readable by all" 
  ON device_public_keys FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Users manage own keys" 
  ON device_public_keys FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Step 5: Add encryption columns to messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS key_nonce TEXT,
ADD COLUMN IF NOT EXISTS data_nonce TEXT,
ADD COLUMN IF NOT EXISTS ephemeral_public_key TEXT;

-- Step 6: Create index
CREATE INDEX IF NOT EXISTS messages_encryption_version_idx ON messages(encryption_version);

-- Step 7: Mark existing messages as legacy
UPDATE messages 
SET encryption_version = 1 
WHERE encryption_version = 3 OR encryption_version IS NULL;

-- That's it! The core zero-knowledge system is ready.