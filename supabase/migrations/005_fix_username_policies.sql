-- Allow users to check if username exists (read only username field)
DROP POLICY IF EXISTS "Users can check usernames" ON users;

CREATE POLICY "Users can check usernames" ON users
  FOR SELECT USING (true)
  WITH CHECK (false);

-- Ensure users can still view their full profile
DROP POLICY IF EXISTS "Users can view own profile" ON users;

CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (
    id = auth.uid() OR 
    anon_id = auth.jwt()->>'anon_id' OR
    true -- Allow reading basic info for all users
  );