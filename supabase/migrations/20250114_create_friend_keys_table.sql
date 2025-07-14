-- Create friend_keys table for E2E encryption between friends
CREATE TABLE IF NOT EXISTS friend_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friend_keys_user_id ON friend_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_keys_friend_id ON friend_keys(friend_id);

-- Enable Row Level Security
ALTER TABLE friend_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own and friends' public keys" ON friend_keys;
DROP POLICY IF EXISTS "Users can insert their own public keys" ON friend_keys;
DROP POLICY IF EXISTS "Users can update their own public keys" ON friend_keys;

-- Create RLS policies
CREATE POLICY "Users can view their own and friends' public keys" ON friend_keys
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert their own public keys" ON friend_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own public keys" ON friend_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- Add updated_at trigger
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