# WYD - Anonymous Chat App Development Roadmap

## Project Overview
**WYD** (What You Doing) is an anonymous chat app for young adults that connects strangers for ephemeral conversations through text, voice, and video messages. Think "Omegle meets Snapchat" with a fun, casual vibe.

## Core Concept
- Anonymous stranger chat with optional friend connections
- All messages are ephemeral (disappear after viewing)
- Simple E2E encryption for privacy
- Fun, young adult-focused branding
- Mobile-only (iOS and Android) - no web version

## Phase 1: MVP - Anonymous Chat ✅ COMPLETED
*All features documented in CHANGELOG.md*

## Phase 2: Account Recovery + Remaining Features (1-2 weeks)

### Current Priority: E2E Encryption for Friend Messages 🚨
**CRITICAL SECURITY ISSUE**: Friend messages are currently stored in PLAIN TEXT

- [ ] **🚨 URGENT: E2E Encryption for Friend Messages** (2-3 days)
  - [ ] Implement key exchange for friend relationships
  - [ ] Encrypt text messages before database storage
  - [ ] Decrypt messages on client side only
  - [ ] Ensure server cannot read friend message content
  
- [ ] **Complete Friend Chat Features** (2-3 days)
  - [ ] Voice message support in friend chat UI
  - [ ] Progress indicators for upload/download
  - [ ] Message history with pagination
  - [ ] Last message preview in friends list (encrypted)

### Implementation Priority Order:
1. **🚨 URGENT: Implement E2E Encryption for Friend Messages** (2-3 days) 
   - **SECURITY RISK**: Currently all friend messages stored in plain text
   - Day 1: Implement friend key exchange system
   - Day 2: Add client-side encryption/decryption for text messages
   - Day 3: Test encryption between devices, audit security

2. **Complete Friend Chat Features** (2-3 days) 
   - Voice message encryption integration
   - Message history with proper decryption
   - Last message previews (encrypted)

2. **Account Recovery System** (3-4 days) 
   - Critical for user retention
   - Must have before launch
   
3. **Remaining Features** (2-3 days)
   - Video messages
   - Screenshot prevention
   - Premium features

### Remaining Phase 1 Features
- [ ] **Complete Anonymous Chat**
  - [ ] Video message recording (30s limit)
  - [ ] Screenshot prevention (Android) / detection (iOS)
  - [ ] Screen recording blocking

### Remaining Technical Tasks
- [ ] **Encryption Implementation**
  - [ ] Implement message encryption for text
  - [ ] Add friend key exchange system
  - [ ] Update database for encrypted storage
- [ ] **UX Enhancements**
  - [ ] Add typing indicators
  - [ ] Handle offline message queue
  - [ ] Add read receipts (optional)

### 🚨 IMMEDIATE SECURITY CONCERNS
**Current State**: Friend messages are stored and transmitted in PLAIN TEXT
**Risk Level**: HIGH - Violates core privacy promise of the app
**Action Required**: Implement E2E encryption before any production use

**Anonymous Chat**: ✅ Already has proper E2E encryption via NaCl
**Friend Chat**: ❌ NO ENCRYPTION - All messages readable by server/database

### Friend Message Encryption Implementation Plan
**Goal**: Match the security level of anonymous chat for friend messages

**Technical Approach**:
1. **Key Exchange for Friends**:
   - Generate unique encryption keys when friendship is established
   - Store friend's public key in friends table
   - Use existing E2E encryption utilities from anonymous chat

2. **Message Encryption Flow**:
   - Encrypt message content client-side before sending
   - Store only encrypted content in database
   - Decrypt on recipient's device using shared keys
   - Server cannot read message content

3. **Database Changes**:
   - Add `friend_public_key` column to friends table
   - Ensure `content` column only stores encrypted data
   - Add `nonce` column for encryption security

4. **Code Changes**:
   - Extend `AnonymousEncryption` utility for friend messages
   - Update `FriendChatScreen` to encrypt before send/decrypt after receive
   - Update message loading to handle decryption failures gracefully

**Files to Modify**:
- `src/utils/friendEncryption.ts` (new - based on AnonymousEncryption)
- `src/screens/FriendChatScreen.tsx` (add encryption/decryption)
- Database migration for friend key storage

### Account Recovery System (Priority: HIGH 🔥)
**Why Priority**: Users losing accounts = bad retention, must fix before launch
**Implementation Order**: After unified friend chat completion

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
- [ ] Dark/Light mode
  - [ ] System preference detection
  - [ ] Manual toggle in settings
  - [ ] Persist user preference
- [ ] Analytics setup
  - [ ] Anonymous usage metrics
  - [ ] Conversion tracking
  - [ ] Safety monitoring

## Technical Stack
- **Frontend**: React Native (Expo) - iOS & Android only
- **Backend**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **Encryption**: NaCl (TweetNaCl) - Anonymous chat only currently
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