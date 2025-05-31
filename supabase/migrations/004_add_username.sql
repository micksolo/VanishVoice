-- Add username column to users table
ALTER TABLE users 
ADD COLUMN username TEXT UNIQUE;

-- Add check constraint for username format (alphanumeric + underscore, 3-20 chars)
ALTER TABLE users
ADD CONSTRAINT username_format CHECK (
  username IS NULL OR 
  (username ~ '^[a-zA-Z0-9_]{3,20}$')
);

-- Create index for username lookups
CREATE INDEX idx_users_username ON users(username);

-- Update RLS policy to allow users to update their own username
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (
    id = auth.uid() OR 
    anon_id = auth.jwt()->>'anon_id'
  )
  WITH CHECK (
    id = auth.uid() OR 
    anon_id = auth.jwt()->>'anon_id'
  );

-- Function to check username availability
CREATE OR REPLACE FUNCTION check_username_available(desired_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM users 
    WHERE LOWER(username) = LOWER(desired_username)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;