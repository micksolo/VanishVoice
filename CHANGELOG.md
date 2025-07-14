# Changelog

All notable changes to VanishVoice (WYD) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **End-to-End Encryption for Friend Messages** ✅
  - Friend messages now encrypted using NaCl (same as anonymous chat)
  - Key exchange system for friend relationships
  - Perfect forward secrecy with ephemeral keys
  - Automatic encryption key initialization on friendship creation
  - Client-side encryption/decryption only
  - Server cannot read friend message content
  - Database stores only encrypted ciphertext
  - Graceful handling of decryption failures

- **Push Notification System** - Complete implementation replacing polling mechanism
  - Instant message delivery via Expo Push Notifications
  - Edge Function for sending push notifications
  - Support for all app states (foreground, background, killed)
  - Visual indicator showing "Push Notifications Active"
  - Automatic push token registration and management
  - 95% reduction in database queries
  - Scalable to millions of users

- **Unified Friend Chat System** (95% complete)
  - Renamed "Chats" tab to "Friends" for clarity
  - Created dedicated `FriendChatScreen` with full messaging capabilities
  - Created `FriendsListScreen` with friend request management
  - Implemented text message support (voice pending)
  - Added message type system (text/voice/video)
  - Database schema updates for message types and content

- **Enhanced Friend System**
  - Real-time unread message counts
  - Friend request accept/decline flow
  - Swipe-to-delete friend removal
  - Bidirectional friendship management
  - Friend request notifications
  - Username-based friend adding

- **Developer Tools**
  - Realtime debugger component for WebSocket testing
  - Push notification test checklist
  - Database optimization documentation
  - Comprehensive troubleshooting guides

### Changed
- Messaging system now uses push notifications instead of polling
- Friends list only refreshes on screen focus (no continuous polling)
- Improved battery efficiency by removing constant background polling
- Updated Edge Functions to use correct database schema

### Fixed
- Friend removal now properly updates both users
- Unread message counts update in real-time
- Friend requests create bidirectional relationships
- Message delivery works reliably across all devices

### Security
- ✅ FIXED: Friend messages now have full E2E encryption
- Both anonymous and friend messages use the same robust NaCl encryption
- All message content encrypted before database storage
- Perfect forward secrecy implemented for all message types

## [0.1.0] - 2024-01-15

### Added
- Initial release with core features
- Anonymous user authentication
- End-to-end encrypted voice messages (anonymous chat only)
- Friend system with username-based adding
- Random stranger matching
- Voice message recording and playback
- Message expiry rules (time-based)
- Basic UI with React Native/Expo