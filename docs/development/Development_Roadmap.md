# WYD - Anonymous Chat App Development Roadmap

## Project Overview
**WYD** (What You Doing) is an anonymous chat app for young adults that connects strangers for ephemeral conversations through text, voice, and video messages. Think "Omegle meets Snapchat" with a fun, casual vibe.

## Core Concept
- Anonymous stranger chat with optional friend connections
- All messages are ephemeral (disappear after viewing)
- Simple E2E encryption for privacy
- Fun, young adult-focused branding
- Mobile-only (iOS and Android) - no web version

## Development Philosophy
**Core Features First**: Complete the essential user experience before adding account management. Users can't miss features they haven't experienced yet, but they will immediately notice missing core functionality.

## Phase 1: MVP - Anonymous Chat ✅ COMPLETED
*All features documented in CHANGELOG.md*

## Phase 2: Core Features Completion (1-2 weeks)

### Current Priority: Complete Core Messaging Features
*Friend Chat Features completed - see CHANGELOG.md*

### Implementation Priority Order:
1. **CRITICAL: Video/Voice Message Performance Optimization** (1 week) ✅ COMPLETED
   - ✅ Achieved: 3-5MB videos (88% reduction), 3-5s uploads
   - ✅ Voice messages: 20-30x faster processing
   - ⚠️ Known issue: Video decryption 10-15s (future optimization needed)
   
2. **Video Messages** (2-3 days) ✅ COMPLETED
   - Complete the core messaging triad (text/voice/video)
   - Essential for competitive parity
   - 30-second limit for both anonymous and friend chat
   - E2E encrypted like voice messages
   
3. **Ephemeral Message System** (1-2 days)
   - Core feature: "disappear after viewing"
   - Auto-deletion after first view
   - Time-based expiry options
   - Visual indicators for ephemeral status
   
4. **Screenshot Prevention** (1 day)
   - Critical for ephemeral messaging trust
   - Android: actual prevention
   - iOS: detection and notification
   
5. **Account Recovery System** (3-4 days)
   - Important for retention but not blocking core UX
   - Users need complete experience first

### Video Messages Implementation Details ✅ COMPLETED
*All video message features have been implemented - see CHANGELOG.md for details*

### Video/Voice Message Performance Optimization ✅ COMPLETED
*All performance optimization features have been implemented - see CHANGELOG.md for details*

### Remaining Core Features
- [ ] **Ephemeral Messaging** - PARTIAL IMPLEMENTATION
  - [x] Database schema for ephemeral messages ✅
  - [x] mark_message_viewed function ✅  
  - [x] UI components (CountdownTimer, EphemeralIndicator) ✅
  - [ ] Auto-delete after viewing (backend job needed)
  - [ ] Screenshot detection/prevention
  
- [ ] **Anonymous Chat Enhancements**
  - [ ] Better stranger matching
  - [ ] Skip/Next functionality
  - [ ] Report/Block system

### Remaining Technical Tasks
- [ ] **Comprehensive UX/UI Redesign** (Priority: HIGH - 8 weeks)
  - [x] **Phase 1: Foundation (Weeks 1-2)** ✅ COMPLETED
    - [x] Set up theme system with light/dark mode support ✅
    - [x] Create base UI component library (buttons, inputs, cards) ✅
    - [x] Fix critical UX issues (touch targets, loading states) ✅
    - [x] Implement color system with semantic tokens ✅
  - [ ] **Phase 2: Core Components (Weeks 3-4)** IN PROGRESS
    - [x] Migrate all screens to use theme system (FriendsListScreen completed ✅)
    - [x] Redesign message bubbles with proper status indicators ✅
    - [ ] Improve recording interface (tap-to-start, visual feedback)
    - [x] Create empty state components ✅
    - [x] Implement consistent spacing system (4px grid) ✅
  - [ ] **Phase 3: Visual Polish (Weeks 5-6)**
    - [ ] Add animations and micro-interactions
    - [ ] Implement haptic feedback
    - [ ] Create custom icon system
    - [ ] Polish platform-specific enhancements
  - [ ] **Phase 4: Accessibility (Weeks 7-8)**
    - [ ] Add screen reader support
    - [ ] Ensure WCAG AA color contrast
    - [ ] Support reduced motion preferences
    - [ ] Test with accessibility tools
  - [ ] **Key Improvements** PARTIALLY COMPLETE
    - [x] Modern color palette (Purple accent: #6C63FF) ✅
    - [x] Standardized typography system ✅
    - [x] Reusable component patterns ✅
    - [ ] Consistent animation guidelines
    - [ ] Improved ephemeral indicators
    - [ ] Better error handling and feedback

- [ ] **Additional UX Enhancements**
  - [ ] Add typing indicators
  - [ ] Handle offline message queue
  - [ ] Add read receipts (optional)

### ✅ SECURITY STATUS UPDATE
**Text Messages**: ✅ E2E encrypted via SharedSecretEncryption
**Voice Messages**: ✅ E2E encrypted via secureE2EAudioStorage
**Video Messages**: ✅ E2E encrypted via secureE2EVideoStorageFastAndroid
**Anonymous Chat**: ✅ E2E encrypted via NaCl

All message types now have proper E2E encryption:
- Text: Shared secret encryption with authentication
- Voice: Unique key per message, encrypted with recipient's key
- Video: XOR encryption with unique keys, encrypted with shared secret
- Anonymous: NaCl box encryption with ephemeral keys
- Server cannot decrypt any message content, audio, or video


### Account Recovery System (Priority: MEDIUM)
**Why Important**: Users losing accounts = bad retention
**When to Implement**: After core features are complete and polished

- [ ] **Username + Password Recovery**
  - [ ] Add password_hash field to users table (nullable)
  - [ ] "Set Password" UI in Profile screen (optional but encouraged)
  - [ ] Password validation (min 8 chars, strong password rules)
  - [ ] Secure password hashing (bcrypt/argon2)
  - [ ] Remove old recovery code system (recoveryCode.ts)
  
- [ ] **Account Recovery Flow**
  - [ ] "Sign In" option on auth screen
  - [ ] Username + password login form
  - [ ] Recover: identity, friends list, settings, premium status
  - [ ] Generate new encryption keys on new device
  - [ ] Clear messaging: "Messages are end-to-end encrypted and cannot be recovered"
  - [ ] Store new device keys in key_storage table

- [ ] **Default Username System** ✅
  - [x] Auto-generate fun usernames (CoolPanda123)
  - [x] Ensure uniqueness on creation
  - [ ] Show username prominently in UI (home screen welcome)
  - [ ] Encourage password setup in onboarding flow

- [ ] **Security Considerations**
  - [ ] Hybrid approach: password recovers identity, not messages
  - [ ] Each device gets unique encryption keys
  - [ ] Friends can re-establish secure connections
  - [ ] Optional: backup encryption keys to cloud (future feature)

### Friend System Enhancements  
- [ ] Enhanced friend features
  - [ ] Optional profile photo upload
  - [ ] Phone number hashing for discovery
  - [ ] QR code/link sharing
  - [ ] Online/offline status
  - [ ] Last seen timestamps
  - [ ] Friend list organization

### Premium Tier ($4.99/month)
- [ ] Gender filter (male/female/any)
- [ ] Location filter (country/continent)
- [ ] Payment integration
  - [ ] Apple Pay / In-App Purchase (iOS)
  - [ ] Google Play Billing (Android)
- [ ] Premium UI indicators

## Phase 3: Safety & Polish (1 week)

### Safety System
- [ ] Automated strike system
  - [ ] Report tracking
  - [ ] Progressive bans (1 day → 7 days → permanent)
  - [ ] Shadow banning for bad actors
- [ ] Trust-based matching
  - [ ] Match by trust scores
  - [ ] Separate pools for reported users
- [ ] Device fingerprinting for ban enforcement

### Polish & Launch
- [ ] Onboarding flow
  - [ ] Age verification (18+)
  - [ ] Community guidelines
  - [ ] Quick tutorial
- [ ] Performance optimization
  - [ ] Message queueing
  - [ ] Connection indicators
  - [ ] Error handling
- [x] Dark/Light mode ✅ COMPLETED
  - [x] System preference detection ✅
  - [x] Manual toggle in settings ✅
  - [x] Persist user preference ✅
- [ ] Analytics setup
  - [ ] Anonymous usage metrics
  - [ ] Conversion tracking
  - [ ] Safety monitoring

## Technical Stack
- **Frontend**: React Native (Expo) - iOS & Android only
- **Backend**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **Encryption**: NaCl (TweetNaCl) - Both anonymous and friend chat ✅
- **Push Notifications**: Expo Push Service ✅ (Implemented)
- **Payments**: Native IAP only (no Stripe needed) - Pending
- **Analytics**: Mixpanel/Amplitude - Pending

## Design Guidelines
- **Brand**: Fun, casual, young adult focused
- **Colors**: Bright, playful palette
- **Typography**: Modern, readable, slightly playful
- **Interactions**: Smooth animations, haptic feedback
- **Tone**: Casual, friendly, never serious

## Success Metrics
- Daily active users
- Average session length
- Messages per conversation
- Premium conversion rate
- Report rate (lower is better)
- User retention (1-day, 7-day)

## Future Features (Post-Launch)
- **Performance: Native Crypto Optimization** (High Priority)
  - Video decryption currently 10-15s (nacl.secretbox limitation)
  - Implement native crypto libraries or streaming decryption
  - Target: <3s total download time for videos
- Interest/topic matching
- Voice filters (fun effects)
- Group chat rooms
- React to messages
- Enhanced privacy features (blur on background, watermarks)
- Verified badges for content creators
- AR filters for video messages

## Key Decisions
- Simple E2E encryption (not Signal-level)
- No message history by default
- Device-based identity (not accounts)
- Gender + location as primary paid features
- Focus on 18-25 age demographic
- English-first, expand languages later

## Repository
- GitHub: https://github.com/micksolo/WYD
- Will need new app store listings
- New privacy policy for anonymous chat
- Updated terms of service

## Tagline Ideas (Security-Focused)
- "WYD? Chat anonymously. Actually anonymously."
- "Anonymous chat that even we can't read"
- "WYD? Find out. Securely."
- "Real privacy. Real conversations. WYD?"
- "Chat like Snap. Secure like Signal. WYD?"
- "Your chats. Your keys. WYD?"
- "E2E encrypted. Actually ephemeral. WYD?"
- "They can't read it. We can't read it. WYD?"

## Key Differentiator
Unlike Snapchat and other "anonymous" apps, WYD features:
- True end-to-end encryption (messages are encrypted on your device)
- No server-side message access (we literally cannot read your messages)
- Ephemeral by design (messages truly disappear)
- No data mining or ad targeting (because we can't see your content)