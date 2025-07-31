# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WYD (What You Doing) is an anonymous chat app that connects strangers for ephemeral conversations through text, voice, and video messages. Built with React Native (Expo) and Supabase, featuring E2E encryption.

## Tech Stack

### Frontend
- **Framework**: React Native via Expo (TypeScript)
- **State Management**: React Context + Zustand
- **Audio**: react-native-audio-toolkit or similar for recording/playback
- **Encryption**: tweetnacl or react-native-crypto for client-side AES-256
- **Notifications**: expo-notifications

### Backend
- **Platform**: Supabase (PostgreSQL + Storage + Auth + Realtime)
- **Functions**: Supabase Edge Functions (JavaScript/TypeScript)
- **Optional**: Vercel/Netlify Functions for custom endpoints

## Development Commands

Since this is an Expo/React Native project, expected commands would be:
- `npm install` or `yarn install` - Install dependencies
- `npx expo start` - Start development server
- `npx expo run:ios` - Run on iOS simulator
- `npx expo run:android` - Run on Android emulator
- `npm test` or `yarn test` - Run Jest tests
- `npx expo build` - Create production builds via EAS

## Architecture

### Key Components
1. **Voice Recording/Playback**: One-tap recording with waveform visualization
2. **Message Expiry System**: Three types of expiry rules stored as JSONB:
   - Time-based: `{ "type": "time", "duration_sec": 60 }`
   - Location-based: `{ "type": "geo", "radius_m": 100, "lat": 59.437, "lng": 24.7536 }`
   - Event-based: `{ "type": "event", "event_id": "abc123" }`
3. **Encryption Flow**: Client encrypts voice data before upload; server stores only ciphertext
4. **Mutual Save Feature**: Recipients can request save during playback; requires sender approval

### Database Schema
- `users` table: Stores user IDs and anonymous identifiers
- `messages` table: Stores message metadata, expiry rules, and encrypted media paths
- Row-level security policies ensure only sender/recipient access

### API Endpoints
- `/api/register` - User registration/guest creation
- `/api/send-message` - Upload encrypted voice messages
- `/api/listen-message/{id}` - Fetch and decrypt messages
- `/api/expiry-check` - Edge function for message expiration
- `/api/request-save/{id}` - Recipient save request
- `/api/approve-save/{id}` - Sender save approval

## Important Notes
- All voice data must be encrypted client-side before storage
- Implement scheduled Edge Functions to purge expired messages
- Use Supabase Realtime for live message state updates
- Anonymous user support is required for "Random Connect" feature

## Agent Orchestration Rule

**MANDATORY DEFAULT BEHAVIOR**: When receiving ANY request or question, Claude Code MUST automatically use the vv-pm agent to orchestrate the work with the team of agents, unless explicitly specified otherwise by the user.

This ensures:
- Proper task planning and coordination across all agents
- Efficient delegation to specialized agents (vv-engineer, vv-designer, monetization-specialist)
- Better project management and tracking
- Comprehensive solutions using the full agent team
- Consistent workflow and documentation updates

The vv-pm agent will:
1. Analyze the request and break it down into tasks
2. Delegate appropriate tasks to specialized agents
3. Coordinate the work between agents
4. Track progress and ensure completion
5. Update relevant documentation (roadmap, changelog, etc.)

**For bug fixes and feature improvements**: The vv-pm agent should skip creating interim documentation and proceed directly to planning and implementation. Only update final documentation (changelog) after fixes are complete.

To bypass this default behavior, users can explicitly state "without agents" or "no agents" in their request.

## Security Requirements (MANDATORY)

### End-to-End Encryption Rule
**ALL content sent between users MUST be end-to-end encrypted. This includes:**
- Text messages
- Voice messages
- Images/videos (future features)
- Any other user-generated content

**Implementation Requirements:**
1. Use recipient's public key to encrypt content or content encryption keys
2. Only store encrypted data and encrypted keys in the database
3. Server/Supabase must NEVER have access to decryption keys
4. Follow the existing E2E pattern used in `FriendEncryption` class

**Before implementing ANY feature that sends content:**
1. Review the E2E encryption implementation for text messages
2. Ensure the same security model is applied
3. Never store encryption keys in plaintext in the database
4. Test that server cannot decrypt the content

**Current Status:**
- ✅ Text messages: Properly E2E encrypted using SharedSecretEncryption
- ✅ Voice messages: Properly E2E encrypted using secureE2EAudioStorage module
- ✅ Video messages: Properly E2E encrypted using secureE2EVideoStorageFastAndroid module

## Git Commit Guidelines

### Pre-Commit Checklist (REQUIRED)
When creating a git commit, ALWAYS follow this sequence:

1. **Code Cleanup**
   - Remove or archive old/unused files
   - Delete temporary test files and scripts
   - Ensure no debugging code remains in production files
   - Clean up any console.log statements that aren't needed
   - Archive deprecated code to a separate directory if needed for reference

2. **Update CHANGELOG.md**
   - Add completed features to the appropriate phase section
   - Include technical details and implementation notes
   - Mark features as ✅ completed

3. **Update Development_Roadmap.md** 
   - Remove completed features/tasks from roadmap
   - Move items from `[ ]` to changelog instead of marking `[x]`
   - Keep roadmap focused on upcoming work, not completed work
   - Reference changelog for completed items: `*All features documented in CHANGELOG.md*`

4. **Update CLAUDE.md (if applicable)**
   - If we learned something important during the task, add it here
   - Document any new patterns, gotchas, or best practices discovered
   - Add any new rules or guidelines that should be followed
   - Update tech stack or architecture sections if changes were made

5. **Commit Process**
   - DO NOT create git commits until features have been manually tested
   - Ensure all tests pass before committing
   - Get confirmation that manual testing is complete
   - Use clear commit messages describing what was implemented

### Documentation Maintenance Rules
- **Changelog**: Historical record of what's been built (grows over time)
- **Roadmap**: Future-focused planning document (items removed when complete)
- **No Duplication**: Don't list the same completed feature in both docs
- **Clean Roadmap**: Remove completed sections entirely to maintain focus
- **CLAUDE.md**: Living document that captures learnings and evolves with the project

## Lessons Learned

### Voice Message Implementation
- **Platform Differences**: iOS and Android handle audio differently. Always test on both platforms.
- **File Formats**: Use .mp4 for better cross-platform compatibility (not .mp3)
- **Audio Configuration**: Avoid iOS-specific settings like `interruptionModeIOS` when not needed
- **Recording Presets**: Use `Audio.RecordingOptionsPresets.HIGH_QUALITY` for best compatibility

### E2E Encryption Implementation
- **Shared Secrets**: Use deterministic key derivation so both users can compute the same secret without key exchange
- **Key Storage**: Never store encryption keys in plaintext in the database - always encrypt them with recipient's key
- **Migration Strategy**: When updating encryption, provide clear migration paths for existing data
- **Verification**: Always provide ways to verify encryption is working (debug tools, database checks)

### UI/UX Patterns
- **Long Press Issues**: Long press gestures can be unreliable in React Native. Consider tap-based alternatives.
- **Recording UI**: Show clear visual feedback during recording (waveforms, duration, etc.)
- **Error Handling**: Provide user-friendly error messages for audio playback issues

### Video Message Implementation
- **Expo Camera Limitations**: expo-camera ignores bitrate settings on both iOS and Android
- **File Sizes**: Expect 50MB+ for 30s videos at 720p/1080p (not the 5-10MB you'd expect)
- **Compression**: Client-side video compression not available in Expo managed workflow
- **Performance**: XOR encryption is fast enough for 50MB files (~4s decrypt on download)
- **Solution**: Accept large files for now, implement server-side compression later (like Snapchat/WhatsApp)

### Ephemeral Messaging Implementation
- **Database Design**: Use computed columns (is_expired) for efficient expiry checking
- **Deletion Strategy**: Soft delete first, then hard delete after retention period
- **Audit Trail**: Always log deletions for trust and potential recovery needs
- **Real-time Updates**: Subscribe to both UPDATE (expired flag) and DELETE events
- **Media Cleanup**: Edge functions need service role to delete from storage buckets
- **Scheduling Options**: pg_cron (if available), external cron services, or edge function webhooks
- **UI/UX**: Show clear visual indicators for ephemeral content, use animations for deletion

### Development Builds Setup
- **Purpose**: Allows native modules (like react-native-compressor) while keeping Expo workflow benefits
- **EAS CLI**: Already configured with project ID in app.json
- **Build Profiles**: Use `development` for simulators, `development-device` for physical devices
- **Rebuild Required**: Must rebuild dev client when adding/removing native modules
- **Scripts Added**: `npm run build:dev:*` commands for easy building
- **Metro Config**: Enhanced to support CommonJS modules and native module resolution
- **Testing**: Always test on both iOS and Android with development builds before considering complete

### React Native SVG and Package Management
- **Version Stability**: Use specific stable versions for critical packages (react-native-svg: 15.11.2)
- **SVG Crashes**: Newer versions of react-native-svg can cause crashes in development builds
- **Package Updates**: Always test thoroughly when updating native module dependencies
- **Metro Configuration**: Simplified resolver configuration works better than complex polyfills
- **Node.js Modules**: Use minimal polyfills - let Metro handle most module resolution automatically