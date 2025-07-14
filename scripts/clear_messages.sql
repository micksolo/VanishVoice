-- Clear all messages from the database
-- This will remove all existing messages (both plain text and encrypted)

-- Delete all messages
DELETE FROM messages;

-- Optional: Reset any message-related sequences if needed
-- This ensures new messages start with fresh IDs

-- Verify the deletion
SELECT COUNT(*) as remaining_messages FROM messages;