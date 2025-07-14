-- Setup fresh encryption environment
-- Run this to clear messages and ensure encryption tables exist

-- 1. Clear all existing messages
DELETE FROM messages;

-- 2. Create friend_keys table if it doesn't exist
CREATE TABLE IF NOT EXISTS friend_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friend_keys_user_id ON friend_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_keys_friend_id ON friend_keys(friend_id);

-- 4. Enable Row Level Security
ALTER TABLE friend_keys ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own and friends' public keys" ON friend_keys;
DROP POLICY IF EXISTS "Users can insert their own public keys" ON friend_keys;
DROP POLICY IF EXISTS "Users can update their own public keys" ON friend_keys;

-- 6. Create RLS policies
CREATE POLICY "Users can view their own and friends' public keys" ON friend_keys
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert their own public keys" ON friend_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own public keys" ON friend_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- 7. Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_friend_keys_updated_at ON friend_keys;
CREATE TRIGGER update_friend_keys_updated_at BEFORE UPDATE ON friend_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Add encryption fields to messages table if they don't exist
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS nonce TEXT,
ADD COLUMN IF NOT EXISTS ephemeral_public_key TEXT;

-- 9. Update the is_encrypted column default to true for new messages
ALTER TABLE messages 
ALTER COLUMN is_encrypted SET DEFAULT true;

-- 10. Clear any existing friend encryption keys to start fresh
TRUNCATE TABLE friend_keys;

-- Verification
SELECT 'Messages cleared: ' || COUNT(*) as status FROM messages
UNION ALL
SELECT 'Friend keys table ready: ' || (CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'friend_keys') THEN 'YES' ELSE 'NO' END)
UNION ALL
SELECT 'Encryption columns ready: ' || (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'nonce') THEN 'YES' ELSE 'NO' END);