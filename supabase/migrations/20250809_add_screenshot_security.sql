-- Minimal Security Migration for Zero-Knowledge Encryption Testing
-- Focused on core functionality only

-- Create table for tracking screenshot attempts (simplified)
CREATE TABLE IF NOT EXISTS screenshot_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android')),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add basic indexes
CREATE INDEX IF NOT EXISTS idx_screenshot_attempts_user_id ON screenshot_attempts(user_id);

-- Enable RLS
ALTER TABLE screenshot_attempts ENABLE ROW LEVEL SECURITY;

-- Simple RLS policy - users can only see their own attempts
CREATE POLICY "Users can view own screenshot attempts" 
  ON screenshot_attempts
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can log their own screenshot attempts
CREATE POLICY "Users can log screenshot attempts" 
  ON screenshot_attempts
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create minimal user subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Simple policy
CREATE POLICY "Users can view own subscription" 
  ON user_subscriptions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Simple function to check if user is premium
CREATE OR REPLACE FUNCTION is_premium_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_subscriptions 
    WHERE user_id = p_user_id 
    AND tier = 'premium'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simple function to log screenshot attempt
CREATE OR REPLACE FUNCTION log_screenshot_attempt(
  p_message_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_attempt_id UUID;
BEGIN
  INSERT INTO screenshot_attempts (
    user_id,
    message_id,
    platform
  ) VALUES (
    auth.uid(),
    p_message_id,
    'ios'  -- Default to iOS for simplicity
  ) RETURNING id INTO v_attempt_id;
  
  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add basic security columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS screenshot_protected BOOLEAN DEFAULT FALSE;

-- Insert default free tier for existing users
INSERT INTO user_subscriptions (user_id, tier)
SELECT id, 'free'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_subscriptions)
ON CONFLICT (user_id) DO NOTHING;