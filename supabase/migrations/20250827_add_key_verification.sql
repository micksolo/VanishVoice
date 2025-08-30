-- Add key verification support to key_exchange table
-- This enables tracking verification status and detecting potential MITM attacks

-- Add verification fields to key_exchange table
ALTER TABLE key_exchange ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE key_exchange ADD COLUMN IF NOT EXISTS key_fingerprint TEXT;
ALTER TABLE key_exchange ADD COLUMN IF NOT EXISTS verification_emojis TEXT[];

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_key_exchange_verified ON key_exchange(verified_at);
CREATE INDEX IF NOT EXISTS idx_key_exchange_fingerprint ON key_exchange(key_fingerprint);

-- Create verification_logs table for security monitoring
CREATE TABLE IF NOT EXISTS verification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('completed', 'skipped', 'failed', 'key_changed')),
  key_fingerprint TEXT,
  emojis_matched BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for verification logs
CREATE INDEX IF NOT EXISTS idx_verification_logs_session ON verification_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_type ON verification_logs(verification_type);
CREATE INDEX IF NOT EXISTS idx_verification_logs_created ON verification_logs(created_at);

-- Row Level Security for verification logs
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

-- Only allow users to view their own verification logs
CREATE POLICY "Users can view own verification logs" ON verification_logs
  FOR SELECT USING (
    session_id = auth.jwt()->>'session_id' OR
    partner_id = auth.jwt()->>'session_id'
  );

-- Only allow users to insert their own verification logs
CREATE POLICY "Users can insert own verification logs" ON verification_logs
  FOR INSERT WITH CHECK (
    session_id = auth.jwt()->>'session_id'
  );

-- Create function to log verification events
CREATE OR REPLACE FUNCTION log_verification_event(
  p_session_id TEXT,
  p_partner_id TEXT,
  p_verification_type TEXT,
  p_key_fingerprint TEXT DEFAULT NULL,
  p_emojis_matched BOOLEAN DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  new_log_id UUID;
BEGIN
  INSERT INTO verification_logs (
    session_id,
    partner_id,
    verification_type,
    key_fingerprint,
    emojis_matched
  ) VALUES (
    p_session_id,
    p_partner_id,
    p_verification_type,
    p_key_fingerprint,
    p_emojis_matched
  ) RETURNING id INTO new_log_id;
  
  RETURN new_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION log_verification_event TO authenticated, anon;

-- Add helpful comments
COMMENT ON TABLE verification_logs IS 'Logs key verification events for security monitoring and analytics';
COMMENT ON COLUMN verification_logs.verification_type IS 'Type of verification event: completed, skipped, failed, key_changed';
COMMENT ON COLUMN verification_logs.emojis_matched IS 'Whether users confirmed emoji sequences matched (NULL if skipped)';
COMMENT ON FUNCTION log_verification_event IS 'Logs verification events with proper security context';