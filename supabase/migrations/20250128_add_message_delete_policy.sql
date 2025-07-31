-- Migration: Add DELETE policy for messages table
-- Date: 2025-01-28
-- Purpose: Allow users to delete messages where they are sender or recipient (for "Clear All Chats" functionality)

-- Add DELETE policy for messages table
CREATE POLICY "Users can delete their messages" ON messages
  FOR DELETE USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id
  );

-- Add a database function for safer bulk message deletion
CREATE OR REPLACE FUNCTION delete_user_messages(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Verify the user is authenticated and is deleting their own messages
  IF auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Access denied: Can only delete your own messages';
  END IF;

  -- Delete messages where user is sender or recipient
  DELETE FROM messages 
  WHERE sender_id = target_user_id OR recipient_id = target_user_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the deletion for auditing
  INSERT INTO deletion_log (user_id, action, details, created_at)
  VALUES (
    target_user_id, 
    'bulk_delete_messages', 
    jsonb_build_object('deleted_count', deleted_count),
    NOW()
  );
  
  RETURN deleted_count;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION delete_user_messages(UUID) TO authenticated;