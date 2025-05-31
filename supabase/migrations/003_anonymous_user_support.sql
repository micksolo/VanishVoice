-- Update RLS policies to support anonymous users
-- First, we need to modify the auth check to use the anon_id from the request

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update their messages" ON messages;
DROP POLICY IF EXISTS "Users can view their friends" ON friends;
DROP POLICY IF EXISTS "Users can add friends" ON friends;
DROP POLICY IF EXISTS "Users can remove friends" ON friends;

-- Create new policies that work with anonymous users
-- For anonymous users, we'll use the anon_id passed in the JWT

-- Users policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (
    id = auth.uid() OR 
    anon_id = auth.jwt()->>'anon_id'
  );

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (
    id = auth.uid() OR 
    anon_id = auth.jwt()->>'anon_id'
  );

-- Messages policies
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (
    sender_id = auth.uid() OR 
    recipient_id = auth.uid() OR
    sender_id IN (SELECT id FROM users WHERE anon_id = auth.jwt()->>'anon_id') OR
    recipient_id IN (SELECT id FROM users WHERE anon_id = auth.jwt()->>'anon_id')
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() OR
    sender_id IN (SELECT id FROM users WHERE anon_id = auth.jwt()->>'anon_id')
  );

CREATE POLICY "Users can update their messages" ON messages
  FOR UPDATE USING (
    sender_id = auth.uid() OR 
    recipient_id = auth.uid() OR
    sender_id IN (SELECT id FROM users WHERE anon_id = auth.jwt()->>'anon_id') OR
    recipient_id IN (SELECT id FROM users WHERE anon_id = auth.jwt()->>'anon_id')
  );

-- Friends policies  
CREATE POLICY "Users can view their friends" ON friends
  FOR SELECT USING (
    user_id = auth.uid() OR 
    friend_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE anon_id = auth.jwt()->>'anon_id') OR
    friend_id IN (SELECT id FROM users WHERE anon_id = auth.jwt()->>'anon_id')
  );

CREATE POLICY "Users can add friends" ON friends
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE anon_id = auth.jwt()->>'anon_id')
  );

CREATE POLICY "Users can remove friends" ON friends
  FOR DELETE USING (
    user_id = auth.uid() OR
    user_id IN (SELECT id FROM users WHERE anon_id = auth.jwt()->>'anon_id')
  );

-- Add avatar_seed column that was missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_seed TEXT DEFAULT substr(md5(random()::text), 1, 8);