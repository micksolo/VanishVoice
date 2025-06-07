-- Add auth_tag column for message authentication
ALTER TABLE messages 
ADD COLUMN auth_tag TEXT,
ADD COLUMN encryption_version INTEGER DEFAULT 1;

-- Set version 2 for new secure encryption
UPDATE messages SET encryption_version = 1 WHERE encryption_version IS NULL;

-- Add index for encryption version
CREATE INDEX idx_messages_encryption_version ON messages(encryption_version);

-- Add signature fields for message authentication
ALTER TABLE messages
ADD COLUMN sender_signature TEXT,
ADD COLUMN message_hash TEXT;

-- Update RLS policy to ensure message integrity
CREATE OR REPLACE FUNCTION verify_message_integrity() RETURNS TRIGGER AS $$
BEGIN
  -- Ensure auth_tag is provided for version 2 encryption
  IF NEW.encryption_version = 2 AND NEW.auth_tag IS NULL THEN
    RAISE EXCEPTION 'auth_tag is required for secure encryption';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message integrity
CREATE TRIGGER ensure_message_integrity
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION verify_message_integrity();

-- Add security audit log table
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" ON security_audit_log
  FOR SELECT USING (false); -- No one can view for now

-- Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_action TEXT,
  p_details JSONB
) RETURNS VOID AS $$
BEGIN
  INSERT INTO security_audit_log (user_id, action, details)
  VALUES (p_user_id, p_action, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;