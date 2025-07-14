-- Create friend_keys table for E2E encryption key exchange
CREATE TABLE friend_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_friend_keys_user_id ON friend_keys(user_id);
CREATE INDEX idx_friend_keys_friend_id ON friend_keys(friend_id);
CREATE INDEX idx_friend_keys_lookup ON friend_keys(user_id, friend_id);

-- Enable RLS
ALTER TABLE friend_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for friend_keys
CREATE POLICY "Users can manage their own friend keys" ON friend_keys
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Friends can read each other's public keys" ON friend_keys
  FOR SELECT USING (
    friend_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM friends 
      WHERE friends.user_id = friend_keys.friend_id 
      AND friends.friend_id = friend_keys.user_id
    )
  );

-- Add encryption fields to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS nonce TEXT,
ADD COLUMN IF NOT EXISTS ephemeral_public_key TEXT;

-- Update the is_encrypted column default to true for new messages
ALTER TABLE messages 
ALTER COLUMN is_encrypted SET DEFAULT true;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_friend_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE TRIGGER update_friend_keys_updated_at
  BEFORE UPDATE ON friend_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_friend_keys_updated_at();

-- Comment on the table
COMMENT ON TABLE friend_keys IS 'Stores public keys for E2E encryption between friends';
COMMENT ON COLUMN friend_keys.public_key IS 'NaCl box public key for encryption';
COMMENT ON COLUMN messages.nonce IS 'NaCl nonce for message decryption';
COMMENT ON COLUMN messages.ephemeral_public_key IS 'Ephemeral public key for perfect forward secrecy';