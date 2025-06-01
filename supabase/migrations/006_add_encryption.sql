-- Add encryption-related columns to messages table
ALTER TABLE messages 
ADD COLUMN encryption_iv TEXT,
ADD COLUMN sender_public_key TEXT,
ADD COLUMN encrypted_key TEXT;

-- Add public key to users table for key exchange
ALTER TABLE users
ADD COLUMN public_key TEXT,
ADD COLUMN key_generated_at TIMESTAMPTZ;

-- Update RLS policies to allow users to see public keys
CREATE POLICY "Users can view public keys" ON users
  FOR SELECT USING (true)
  WITH CHECK (false);

-- Add index for faster public key lookups
CREATE INDEX idx_users_public_key ON users(id, public_key);