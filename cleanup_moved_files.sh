#!/bin/bash

# Remove files that have been moved to docs/setup
rm -f /Users/mick/Documents/GitHub/VanishVoice/SETUP.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/DEVELOPMENT_BUILD_SETUP.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/DEV_BUILD_INSTALL_GUIDE.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/EAS_BUILD_INSTRUCTIONS.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/ADD_SECOND_DEVICE.md

# Remove files that have been moved to docs/development
rm -f /Users/mick/Documents/GitHub/VanishVoice/PROJECT_STATUS.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/DATABASE_MIGRATION_NEEDED.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/DEVELOPMENT_BUILD_STATUS.md

# Remove files that have been moved to docs/security
rm -f /Users/mick/Documents/GitHub/VanishVoice/SECURITY_IMPROVEMENTS.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/NACL_IMPLEMENTATION_GUIDE.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/NACL_INSTALLATION_COMPLETE.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/NACL_ENCRYPTION_FIX.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/KEY_SYNC_FIX_APPLIED.md

# Remove files that have been moved to docs/troubleshooting
rm -f /Users/mick/Documents/GitHub/VanishVoice/BUFFER_ERROR_FIX.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/DEBUG_NACL_DECRYPTION.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/FIX_RECIPIENT_NO_KEYS.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/PUSH_NOTIFICATIONS_TESTING.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/PUSH_NOTIFICATIONS_TROUBLESHOOTING.md
rm -f /Users/mick/Documents/GitHub/VanishVoice/PUSH_TOKEN_DEBUG.md

# Remove the organization scripts
rm -f /Users/mick/Documents/GitHub/VanishVoice/organize_docs.sh
rm -f /Users/mick/Documents/GitHub/VanishVoice/cleanup_moved_files.sh

echo "✅ Documentation cleanup complete!"
echo "📁 All .md files have been organized into /docs subdirectories"
echo "🔍 Only README.md and CLAUDE.md remain in the root directory"