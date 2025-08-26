# VanishVoice - Development Roadmap

## Project Overview
**VanishVoice** is an anonymous chat app that connects strangers for ephemeral conversations through text, voice, and video messages. Built with privacy-first principles and end-to-end encryption.

## Core Features
- Anonymous stranger chat with optional friend connections
- All messages are ephemeral with E2E encryption
- Premium filters for enhanced matching (location, gender, safety)
- Trust-based safety system with anonymous reporting
- Mobile-only (iOS and Android)

## Development Focus
**Revenue-First Development**: Prioritize monetization features that provide immediate user value while maintaining privacy principles.

## Current Status: Ready for Monetization

### ✅ COMPLETED FOUNDATION
**Core Platform**: ✅ Complete - E2E encryption, voice/video messages, anonymous chat, friend system
**Security**: ✅ Complete - All message types E2E encrypted
**Infrastructure**: ✅ Complete - Supabase backend, push notifications, development builds

## NEXT PRIORITY: Security Remediation (Uphold “Even From Us” Pledge)

Goal: Eliminate server-decryptable paths, add authenticity and AEAD to all media, lock down key storage, and enforce immediate ephemerality.

### Key Gaps Identified
- Friend chats decryptable by server: ID‑derived “shared secret” (`sharedSecretEncryption.ts`) used by `friendEncryption.ts`, `secureE2EAudioStorage.ts`, `secureE2EVideoStorageFastAndroid.ts` allows the backend to compute the same secret and decrypt content.
- Anonymous chat MITM risk: DB‑mediated key exchange in `anonymousEncryption.ts` has no user verification, enabling potential key substitution by server.
- Audio payload integrity: `secureE2EAudioStorage.ts` uses XOR for audio blobs without AEAD; tampering undetectable.
- Non‑standard crypto: `sharedSecretEncryption.ts` uses XOR + ad‑hoc tag instead of AEAD/HMAC.
- Key storage: Private keys in `AsyncStorage` (e.g., `secureKeyStorage.ts`, `useAnonymousSession.ts`) instead of Keychain/Keystore.
- Logging: Secrets/nonces appear in logs in some utils; risk of sensitive leakage.
- Ephemeral semantics: Server cleanup windows (24–48h) and client cache writes mean content may persist beyond “view/playback”.
- Metadata/linkability: Push payloads include `sender_id`/`sender_name`; a durable `deviceHash` links sessions.

### Remediation Plan (High Priority Tasks)
1. Friend chats → NaCl public‑key model
   - Replace ID‑derived secrets with `nacl.box` key wrapping to recipient public key.
   - Files: `src/utils/friendEncryption.ts`, `src/utils/secureE2EAudioStorage.ts`, `src/utils/secureE2EVideoStorageFastAndroid.ts`.

2. Audio AEAD
   - Encrypt audio blobs with `nacl.secretbox` (per‑message key + 24‑byte nonce). Remove XOR for payloads.
   - File: `src/utils/secureE2EAudioStorage.ts`.

3. Anonymous chat authenticity
   - Add key verification (SAS/emoji/QR) or TOFU with safety numbers + key‑change alerts.
   - File: `src/utils/anonymousEncryption.ts` (+ minimal UI in AnonymousChat).

4. Key storage hardening
   - Move private keys to `react-native-keychain`; keep `AsyncStorage` for non‑secrets only.
   - Files: `src/utils/secureKeyStorage.ts`, `src/hooks/useAnonymousSession.ts`.

5. Logging hygiene
   - Strip secret/nonces/session logs; guard any debug with compile‑time flags; never log secrets in production.
   - Files: `src/utils/nacl/naclEncryption.ts`, `src/utils/e2eEncryptionFixed.ts`, media utils.

6. Ephemeral enforcement
   - Server: synchronous delete on view/read/play via RPC; cron only as short fail‑safe (minutes).
   - Client: delete decrypted files immediately after playback; avoid persisting plaintext in cache.
   - Files: Supabase RPC/Edge Functions (`supabase/functions/expire-messages`), client playback paths.

7. Metadata/linkability minimization
   - Reduce identifiers in push payloads; consider opaque handles/local mapping.
   - Document or rotate/expire `deviceHash` if non‑linkability is desired.

### Acceptance Criteria
- Friend messages (text/audio/video) are unreadable by the server at rest and in transit.
- All media uses AEAD; tampering is detected (decryption fails).
- Anonymous chat offers a user‑verifiable key check or TOFU with safety numbers.
- No private keys in `AsyncStorage`; production builds contain no secret logs.
- On view/play, content is deleted server‑side immediately; client plaintext is removed after use.

### Test/Validation
- Unit tests for encrypt/decrypt round‑trips, tamper detection, versioning.
- Manual tests for key verification flow and ephemeral deletion timing.
- Documentation updates: threat model, guarantees, and limits.

### Key Assets Ready for Monetization:
- Monetization analytics service - functional 
- Payment integration foundation - exists in codebase
- Trust score system - operational for safety features
- Anonymous reporting system - implemented

## IMMEDIATE PRIORITIES: Revenue Generation
**Target**: $6,000-12,000 MRR within 90 days, 15%+ premium conversion rate

### Phase 1: Payment Infrastructure (Week 1)
**Goal**: Enable premium subscriptions and revenue pipeline

#### CRITICAL TASKS:
- [ ] **Payment Integration Setup**
  - Apple Pay/In-App Purchase setup (iOS)
  - Google Play Billing integration (Android) 
  - Premium subscription management ($4.99/month)
  - User tier tracking and feature enforcement

### Phase 2: Premium Discovery Features (Week 2-3)
**Goal**: Launch high-conversion premium features
**Business Value**: Age/gender/location filtering proven 20%+ conversion in anonymous chat apps

#### HIGH PRIORITY FEATURES:
- [ ] **Age Filter Premium Feature**
  - Age range selection: 18-25, 26-35, 36-45, 46+ (all users must be 18+)
  - Premium-only feature with clear legal compliance messaging
  - Expected: 70% of users interested in age-based matching

- [ ] **Gender Filter Premium Feature**
  - Male/Female/Any filtering in anonymous lobby
  - Premium paywall with freemium model (3 free filtered matches/day)
  - Expected: 60% of users try gender filtering in first session

- [ ] **Location-Based Premium Filtering**
  - Country/continent exclusion preferences 
  - Distance-based matching for premium users
  - Privacy-first location collection (IP geolocation + optional GPS)
  - Expected: 45% premium conversion among location-engaged users

### Phase 3: Onboarding & Analytics (Week 4)
**Goal**: Optimize conversion funnel and user data collection

#### CONVERSION OPTIMIZATION:
- [ ] **Enhanced 5-Screen Onboarding Flow**
  - Welcome/Privacy → Age Verification (18+) → Username (optional) → Gender/Age Preferences → Premium Preview
  - Age verification screen for legal compliance (required, no skip)
  - Gender and age preference collection for premium filter targeting
  - Every other screen has skip option to maintain low barrier
  - Soft premium introduction emphasizing privacy benefits

- [ ] **Privacy-First Analytics Infrastructure**
  - Replace Sentry with anonymous analytics
  - Enhanced monetizationAnalytics service integration
  - A/B testing framework for premium messaging optimization

### Phase 4: Safety System Enhancement (Week 5)
**Goal**: Complete safety infrastructure for premium differentiation

#### SAFETY & TRUST FEATURES:
- [ ] **Enhanced Anonymous Reporting System**
  - Complete database schema implementation
  - Admin dashboard for report review and moderation
  - Trust score integration with premium features

- [ ] **Premium Safety Features**
  - "Chat Partner Report History" premium feature
  - Trust-based matching improvements (premium users get higher trust matches)
  - Safety education and user guidelines

- [ ] **Push Notification System Enhancement**
  - Verify Expo Push Service integration is fully operational
  - Premium notification preferences (priority notifications, match alerts)
  - Anonymous chat connection notifications
  - Safety alert notifications for reported users

---

## FUTURE FEATURES (After Revenue Established)

### Phase 5: Advanced Security Features (Week 6-7)
**Goal**: Re-implement premium security features for enhanced privacy
**Business Value**: Security-focused premium features for privacy-conscious users

#### PREMIUM SECURITY FEATURES:
- [ ] **Screenshot Prevention System (Re-implementation)**
  - Android FLAG_SECURE implementation for premium users
  - iOS screenshot detection with premium notifications
  - Premium paywall integration for enhanced privacy
  - User education about screenshot protection benefits
  - Trust indicators showing security level to chat partners

- [ ] **Enhanced Privacy Controls**
  - Premium-only "Disappearing Mode" with advanced deletion
  - Encrypted backup options for premium subscribers
  - Advanced encryption indicators in chat interface
  - Premium privacy analytics (anonymized usage patterns)

### Account Recovery System (Post-Monetization)
**Priority**: MEDIUM - After revenue is established
**Rationale**: User retention improvement, but not revenue-critical

- [ ] Username + password authentication system
- [ ] Device migration workflow for account recovery
- [ ] Security considerations for E2E encrypted message recovery
- [ ] Account recovery UI/UX flows

### Advanced Matching Features (Future Enhancement)
**Priority**: LOW - Engagement optimization after core monetization

- [ ] Interest/topic-based matching algorithms
- [ ] Enhanced skip/next functionality  
- [ ] Connection quality metrics and optimization
- [ ] Geographic network effects and viral features

### Content & Community Features (Growth Phase)
**Priority**: FUTURE - After sustainable revenue established

- [ ] Voice filters and audio effects
- [ ] Group chat rooms and community features
- [ ] Enhanced privacy features (blur backgrounds, watermarks)
- [ ] AR filters for video messages
- [ ] Verified badges for content creators

---

## Technical Foundation
**Frontend**: React Native (Expo) - iOS & Android
**Backend**: Supabase (PostgreSQL + Edge Functions + Realtime + Storage)
**Encryption**: NaCl (TweetNaCl) - All message types ✅ Complete
**Push Notifications**: Expo Push Service ✅ Implemented (needs verification and enhancement)
**Payments**: Native IAP (Apple Pay/Google Play) - Ready for implementation
**Analytics**: Custom privacy-first service (replacing Sentry)

### ✅ ENCRYPTION STATUS (COMPLETE)
**All Message Types**: ✅ E2E encrypted and production-ready
- **Text Messages**: SharedSecretEncryption with authentication
- **Voice Messages**: secureE2EAudioStorage with unique keys per message  
- **Video Messages**: secureE2EVideoStorageFastAndroid with XOR encryption
- **Anonymous Chat**: NaCl box encryption with ephemeral keys

**Privacy Guarantee**: Server cannot decrypt any user content

## Monetization-Focused Design Strategy

### Premium Visual Language
- **Premium Colors**: Electric Purple (#B026FF) for premium badges and features
- **Value Indicators**: Gold accents (#FFD700) for premium tier differentiation
- **Trust Signals**: Cyber Blue (#00D9FF) for safety and encryption indicators
- **Conversion Elements**: Neon Pink (#FF1B8D) for upgrade prompts and CTAs

### Premium UX Patterns
- **Progressive Disclosure**: Reveal premium value through usage
- **Soft Paywalls**: Context-aware premium prompts after positive engagement
- **Value Demonstration**: Interactive previews of premium filter results
- **Trust Building**: Clear privacy explanations for data collection

## Key Success Metrics

### Revenue Metrics (Primary)
- **Monthly Recurring Revenue (MRR)**: Target $6K-12K within 90 days
- **Premium conversion rate**: Target 15%+ (industry standard)
- **Average Revenue Per User (ARPU)**: Track monthly progression
- **Customer Lifetime Value (LTV)**: Monitor premium user retention
- **Churn rate**: Target <30% monthly churn for premium subscribers

### User Engagement Metrics (Secondary)
- **Premium feature adoption rate**: Target 80% of premium users use filters
- **Daily/Weekly Active Users**: Track growth alongside revenue
- **Session length**: Monitor premium vs free user engagement
- **Conversion funnel**: Track onboarding → trial → premium → retention

### Safety & Trust Metrics (Supporting)
- **Report rate**: Monitor safety without fear-inducing increases
- **Trust score distribution**: Track safety system effectiveness  
- **User satisfaction**: Survey-based trust and safety perception

## Performance Optimization (Future)
- **Native Crypto Optimization** (Post-Revenue Priority)
  - Video decryption currently 10-15s (nacl.secretbox limitation)
  - Implement native crypto libraries for faster decryption
  - Target: <3s total download time for large video files

## Strategic Decisions
- **Monetization-first roadmap**: Revenue features prioritized over engagement features
- **Privacy-preserving premium**: Premium features maintain anonymity principles
- **Freemium model**: Basic features free, enhanced discovery/safety premium
- **Trust-based safety**: Device fingerprinting and reputation system over account-based
- **Platform-native payments**: Apple Pay/Google Play only (no Stripe complexity)
- **Anonymous analytics**: Privacy-first metrics that don't compromise user trust

---

## Business Positioning & Launch Strategy

### Revenue-Focused Value Proposition
**VanishVoice Premium**: "Anonymous chat with smart filters for safer connections"
- **Free Tier**: Basic anonymous chat with E2E encryption
- **Premium Tier**: Enhanced discovery (gender/location filters) + safety features
- **Value Messaging**: "Connect with the right people while staying completely anonymous"

### Competitive Differentiation
- **Privacy-First Premium**: Premium features that enhance privacy rather than compromise it
- **Trust-Based Safety**: Anonymous reporting and reputation system without identity tracking
- **True Anonymity**: E2E encryption standard for all users, enhanced filters for premium
- **Mobile-Optimized**: Native mobile experience with platform-appropriate payment integration

### Launch Readiness Checklist
- [ ] Premium subscription infrastructure operational
- [ ] Payment integration complete (Apple Pay/Google Play)
- [ ] Age verification system implemented (18+ legal compliance)
- [ ] Push notification system verified and enhanced
- [ ] Privacy-compliant analytics for conversion tracking
- [ ] Anonymous safety reporting system functional
- [ ] Premium feature differentiation clear and valuable (age/gender/location filters)
- [ ] Customer support prepared for premium subscriber inquiries

---

---

## NEXT STEPS: Start Monetization Implementation

### Immediate Task (This Week):
1. **Payment Integration Setup**: Apple Pay and Google Play Billing integration
2. **Premium Subscription Management**: User tier tracking and feature enforcement
3. **Age Verification System**: Legal compliance for 18+ requirement
4. **Push Notification Verification**: Ensure Expo Push Service is fully operational
5. **Success Metrics Implementation**: Track premium conversion rates and revenue

### Success Target: 
First premium subscribers within 30-45 days, foundation for $6K-12K MRR within 90 days
