#!/bin/bash

# Move setup-related files to docs/setup
mv /Users/mick/Documents/GitHub/VanishVoice/SETUP.md /Users/mick/Documents/GitHub/VanishVoice/docs/setup/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/DEVELOPMENT_BUILD_SETUP.md /Users/mick/Documents/GitHub/VanishVoice/docs/setup/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/DEV_BUILD_INSTALL_GUIDE.md /Users/mick/Documents/GitHub/VanishVoice/docs/setup/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/EAS_BUILD_INSTRUCTIONS.md /Users/mick/Documents/GitHub/VanishVoice/docs/setup/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/ADD_SECOND_DEVICE.md /Users/mick/Documents/GitHub/VanishVoice/docs/setup/ 2>/dev/null

# Move development-related files to docs/development
mv /Users/mick/Documents/GitHub/VanishVoice/DEVELOPMENT_BUILD_STATUS.md /Users/mick/Documents/GitHub/VanishVoice/docs/development/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/DATABASE_MIGRATION_NEEDED.md /Users/mick/Documents/GitHub/VanishVoice/docs/development/ 2>/dev/null

# Move security-related files to docs/security
mv /Users/mick/Documents/GitHub/VanishVoice/SECURITY_IMPROVEMENTS.md /Users/mick/Documents/GitHub/VanishVoice/docs/security/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/NACL_ENCRYPTION_FIX.md /Users/mick/Documents/GitHub/VanishVoice/docs/security/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/NACL_IMPLEMENTATION_GUIDE.md /Users/mick/Documents/GitHub/VanishVoice/docs/security/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/NACL_INSTALLATION_COMPLETE.md /Users/mick/Documents/GitHub/VanishVoice/docs/security/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/KEY_SYNC_FIX_APPLIED.md /Users/mick/Documents/GitHub/VanishVoice/docs/security/ 2>/dev/null

# Move troubleshooting-related files to docs/troubleshooting
mv /Users/mick/Documents/GitHub/VanishVoice/BUFFER_ERROR_FIX.md /Users/mick/Documents/GitHub/VanishVoice/docs/troubleshooting/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/DEBUG_NACL_DECRYPTION.md /Users/mick/Documents/GitHub/VanishVoice/docs/troubleshooting/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/FIX_RECIPIENT_NO_KEYS.md /Users/mick/Documents/GitHub/VanishVoice/docs/troubleshooting/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/PUSH_NOTIFICATIONS_TESTING.md /Users/mick/Documents/GitHub/VanishVoice/docs/troubleshooting/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/PUSH_NOTIFICATIONS_TROUBLESHOOTING.md /Users/mick/Documents/GitHub/VanishVoice/docs/troubleshooting/ 2>/dev/null
mv /Users/mick/Documents/GitHub/VanishVoice/PUSH_TOKEN_DEBUG.md /Users/mick/Documents/GitHub/VanishVoice/docs/troubleshooting/ 2>/dev/null

# Move project status to docs/development
mv /Users/mick/Documents/GitHub/VanishVoice/PROJECT_STATUS.md /Users/mick/Documents/GitHub/VanishVoice/docs/development/ 2>/dev/null

# Remove the .gitkeep files as they're no longer needed
rm /Users/mick/Documents/GitHub/VanishVoice/docs/setup/.gitkeep 2>/dev/null
rm /Users/mick/Documents/GitHub/VanishVoice/docs/development/.gitkeep 2>/dev/null
rm /Users/mick/Documents/GitHub/VanishVoice/docs/security/.gitkeep 2>/dev/null
rm /Users/mick/Documents/GitHub/VanishVoice/docs/troubleshooting/.gitkeep 2>/dev/null
rm /Users/mick/Documents/GitHub/VanishVoice/docs/implementation/.gitkeep 2>/dev/null

echo "Documentation files organized successfully!"
echo "Kept in root: README.md, CLAUDE.md"
echo "Moved to organized subdirectories: all other .md files"