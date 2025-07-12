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

### Week 1: Core Infrastructure ✅
- [x] Rebrand app from VanishVoice to "WYD"
  - [x] Update app.json and package.json
  - [x] Update all UI text and navigation  
  - [x] Clean lobby screen design
- [x] Simplify database schema for anonymous sessions
  - [x] Remove complex friend relationships
  - [x] Add session-based tables (anonymous_sessions, waiting_pool, etc.)
  - [x] Implement auto-cleanup functions
- [x] Build matching engine
  - [x] Waiting pool system with real-time subscriptions
  - [x] Basic 1-to-1 matching with Edge Functions
  - [x] Session management with device hashing

### Week 2: Chat Features ✅
- [x] Multi-modal messaging
  - [x] Text messaging UI with real-time delivery
  - [x] Voice messages (adapted for anonymous)
  - [ ] Video message recording (30s limit) - NEXT
- [x] Simple E2E encryption
  - [x] NaCl box encryption per conversation
  - [x] Ephemeral key exchange mechanism
  - [x] No long-term key storage
- [x] Basic safety features
  - [x] Report button with multiple categories
  - [x] Skip/Next person functionality
  - [x] Trust scoring system
  - [ ] Screenshot prevention (Android) / detection (iOS) - NEXT
  - [ ] Screen recording blocking - NEXT

## Phase 2: Friend System + Premium (1 week)

### Friend Features
- [ ] Hybrid user system
  - [ ] Optional username claiming
  - [ ] Optional profile photo upload
  - [ ] Add friends by username
  - [ ] Phone number hashing for discovery
  - [ ] QR code/link sharing
- [ ] Separate friend chat from stranger chat
  - [ ] Different UI modes
  - [ ] Optional message saving for friends
  - [ ] Friend list management

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
- **Backend**: Supabase
- **Encryption**: NaCl (TweetNaCl)
- **Payments**: Native IAP only (no Stripe needed)
- **Analytics**: Mixpanel/Amplitude
- **Push Notifications**: Expo Push Service

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