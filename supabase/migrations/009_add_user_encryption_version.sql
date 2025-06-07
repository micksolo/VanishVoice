-- Add encryption_version column to users table for NaCl migration tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;

-- Add comment for clarity
COMMENT ON COLUMN users.encryption_version IS 'Tracks the encryption version used by this user: 1=XOR (legacy), 2=Improved, 3=NaCl';

-- Set default version for existing users
UPDATE users SET encryption_version = 1 WHERE encryption_version IS NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_encryption_version ON users(encryption_version);

-- Update the function that handles key updates to include version
CREATE OR REPLACE FUNCTION update_user_public_key(
  p_user_id UUID,
  p_public_key TEXT,
  p_encryption_version INTEGER DEFAULT 3
) RETURNS VOID AS $$
BEGIN
  UPDATE users 
  SET 
    public_key = p_public_key,
    encryption_version = p_encryption_version,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_public_key TO authenticated;