# VanishVoice Documentation

Welcome to the VanishVoice documentation! This directory contains all project documentation organized by category.

## 📁 Directory Structure

### 📋 Project Overview
- [`project_overview.md`](project_overview.md) - High-level project description and goals
- [`technical_specifications.md`](technical_specifications.md) - Detailed technical requirements and architecture
- [`security_audit_checklist.md`](security_audit_checklist.md) - Security audit requirements and checklist

### 🚀 Setup
Documentation for setting up the development environment and building the app:
- [`setup/SETUP.md`](setup/SETUP.md) - Initial project setup instructions
- [`setup/DEVELOPMENT_BUILD_SETUP.md`](setup/DEVELOPMENT_BUILD_SETUP.md) - Setting up development builds for push notifications
- [`setup/DEV_BUILD_INSTALL_GUIDE.md`](setup/DEV_BUILD_INSTALL_GUIDE.md) - Installing development builds on devices
- [`setup/EAS_BUILD_INSTRUCTIONS.md`](setup/EAS_BUILD_INSTRUCTIONS.md) - EAS Build setup for wireless distribution
- [`setup/ADD_SECOND_DEVICE.md`](setup/ADD_SECOND_DEVICE.md) - Adding additional iOS devices to development builds

### 💻 Development
Development guides and project status:
- [`development/PROJECT_STATUS.md`](development/PROJECT_STATUS.md) - Current project status and completed features
- [`development/DEVELOPMENT_BUILD_STATUS.md`](development/DEVELOPMENT_BUILD_STATUS.md) - Development build status and fixes
- [`development/DATABASE_MIGRATION_NEEDED.md`](development/DATABASE_MIGRATION_NEEDED.md) - Required database migrations

### 🔐 Security
Security implementation and encryption documentation:
- [`security/SECURITY_IMPROVEMENTS.md`](security/SECURITY_IMPROVEMENTS.md) - Security improvements implementation
- [`security/NACL_IMPLEMENTATION_GUIDE.md`](security/NACL_IMPLEMENTATION_GUIDE.md) - NaCl (TweetNaCl) implementation guide
- [`security/NACL_INSTALLATION_COMPLETE.md`](security/NACL_INSTALLATION_COMPLETE.md) - NaCl installation completion details
- [`security/NACL_ENCRYPTION_FIX.md`](security/NACL_ENCRYPTION_FIX.md) - NaCl encryption fixes applied
- [`security/KEY_SYNC_FIX_APPLIED.md`](security/KEY_SYNC_FIX_APPLIED.md) - Key synchronization fix details

### 🐛 Troubleshooting
Solutions to common issues and debugging guides:
- [`troubleshooting/BUFFER_ERROR_FIX.md`](troubleshooting/BUFFER_ERROR_FIX.md) - Buffer error fix for React Native
- [`troubleshooting/DEBUG_NACL_DECRYPTION.md`](troubleshooting/DEBUG_NACL_DECRYPTION.md) - Debugging NaCl decryption issues
- [`troubleshooting/FIX_RECIPIENT_NO_KEYS.md`](troubleshooting/FIX_RECIPIENT_NO_KEYS.md) - Fix for "recipient has no keys" error
- [`troubleshooting/PUSH_NOTIFICATIONS_TESTING.md`](troubleshooting/PUSH_NOTIFICATIONS_TESTING.md) - Push notifications testing guide
- [`troubleshooting/PUSH_NOTIFICATIONS_TROUBLESHOOTING.md`](troubleshooting/PUSH_NOTIFICATIONS_TROUBLESHOOTING.md) - Push notifications troubleshooting
- [`troubleshooting/PUSH_TOKEN_DEBUG.md`](troubleshooting/PUSH_TOKEN_DEBUG.md) - Push token registration debugging

### 🛠️ Implementation
(Currently empty - for future implementation guides)

## 🔍 Quick Links

### Getting Started
1. Start with [`setup/SETUP.md`](setup/SETUP.md) for initial setup
2. Review [`project_overview.md`](project_overview.md) for project understanding
3. Check [`development/PROJECT_STATUS.md`](development/PROJECT_STATUS.md) for current status

### For Developers
1. [`technical_specifications.md`](technical_specifications.md) - Technical details
2. [`security/NACL_IMPLEMENTATION_GUIDE.md`](security/NACL_IMPLEMENTATION_GUIDE.md) - Encryption implementation
3. [`troubleshooting/`](troubleshooting/) - Common issues and solutions

### For Security Review
1. [`security_audit_checklist.md`](security_audit_checklist.md) - Security checklist
2. [`security/`](security/) - All security-related documentation

## 📝 Documentation Standards

- All documentation is written in Markdown
- File names use UPPERCASE for visibility
- Each document includes clear headings and sections
- Code examples are properly formatted
- Solutions include step-by-step instructions

## 🤝 Contributing

When adding new documentation:
1. Place it in the appropriate subdirectory
2. Use descriptive file names in UPPERCASE
3. Update this README with a link to the new document
4. Include a brief description of the document's purpose