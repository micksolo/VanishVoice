# Changelog

## WYD App Phase (Current - July 2025)

### Anonymous Chat System ✅
- Complete anonymous matching engine with real-time subscriptions
- E2E encrypted messaging using NaCl encryption
- Trust scoring system for better matches
- Device-based reputation tracking
- Real-time message delivery with Supabase Realtime
- Skip and report functionality for user safety
- Key exchange mechanism for ephemeral conversations

### UI/UX Redesign ✅
- Rebranded from VanishVoice to WYD (What You Doing)
- Clean anonymous lobby screen with filter options
- Premium filter placeholders (gender/location filters)
- Improved navigation flow: Home → Random Connect → Chat
- Modern filter UI with premium badges (⭐)
- Removed excessive branding from matching screen
- Interactive filter selection with premium prompts

### Technical Infrastructure ✅
- Supabase Edge Functions for matching algorithm
- Real-time conversation subscriptions
- Anonymous session management with device hashing
- Encryption timing fixes for instant message delivery
- RLS policies for anonymous data access
- Automatic conversation cleanup
- Enhanced error handling and logging

### Database Schema ✅
- `anonymous_sessions` table for ephemeral user sessions
- `waiting_pool` for matchmaking queue
- `anonymous_conversations` for chat sessions
- `anonymous_messages` with E2E encryption
- `anonymous_reports` for user safety
- `key_exchange` for secure key sharing
- Trust scoring and reputation system

---

## VanishVoice Phase (Completed)

### Initial Setup ✅
- Initialize Expo React Native project with TypeScript
- Set up Supabase project and configure authentication
  - Project URL: https://dhzblvgfexkgkxhhdlpk.supabase.co
- Create database schema with RLS policies
- Configure storage bucket for voice messages

### Core Features ✅
- Anonymous user system with friend codes
- Voice recording (hold-to-record, 60s max)
- Voice message upload/download with Supabase Storage
- Message playback with proper audio routing
- Ephemeral messaging (vanish after playback)
- Friend management (add via code, swipe to delete/block)
- Random Connect feature for anonymous connections
- Unified inbox/friends screen

### UI/UX Improvements ✅
- Modern, clean design with consistent styling
- Swipe actions for friend management
- Floating action button for add friend/random connect
- Empty states with animations
- Navigation renamed from "VanishVoice" to "Chats"
- Improved Profile screen with settings groups
- Privacy-first inbox (sender hidden until tap)
- Username editing with real-time validation
- Keyboard-aware modal for username input
- Bidirectional friend display (see all connections)

### Technical Implementation ✅
- Supabase Edge Functions for message expiry
- Storage cleanup function
- Anonymous auth flow
- Real-time polling (WebSocket disabled)
- Git repository with comprehensive documentation
- Username availability checking
- Profile data refresh on username change
- Smart nickname handling for Random Connect users

### Security Implementation ✅
- Client-side E2E encryption implemented
  - Voice messages encrypted before upload
  - Public/private key pairs generated per user
  - Proper E2E encryption with recipient's public key
  - Fixed encoding issues with binary data handling
  - Encryption keys stored locally in AsyncStorage
- RLS policies in place for data access control
- Storage bucket configured with proper access controls
- NaCl encryption implementation (v3) with migration system