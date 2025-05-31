-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anon_id TEXT NOT NULL UNIQUE,
  friend_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_path TEXT NOT NULL,
  expiry_rule JSONB NOT NULL,
  encryption_key TEXT, -- Store encrypted symmetric key
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  listened_at TIMESTAMP WITH TIME ZONE,
  expired BOOLEAN DEFAULT false,
  CONSTRAINT different_users CHECK (sender_id != recipient_id)
);

-- Friends table for saved connections
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, friend_id),
  CONSTRAINT different_friend CHECK (user_id != friend_id)
);

-- Create indexes for better performance
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_expired ON messages(expired) WHERE NOT expired;
CREATE INDEX idx_friends_user ON friends(user_id);
CREATE INDEX idx_friends_friend ON friends(friend_id);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Messages can only be read by sender or recipient
CREATE POLICY "Users can view their messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id
  );

-- Users can insert messages where they are the sender
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they sent or received (for listened_at)
CREATE POLICY "Users can update their messages" ON messages
  FOR UPDATE USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id
  );

-- Friends policies
CREATE POLICY "Users can view their friends" ON friends
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() = friend_id
  );

CREATE POLICY "Users can add friends" ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove friends" ON friends
  FOR DELETE USING (auth.uid() = user_id);