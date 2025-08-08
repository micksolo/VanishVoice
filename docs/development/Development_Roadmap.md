# WYD - Anonymous Chat App Sprint Development Roadmap

## Project Overview
**WYD** (What You Doing) is an anonymous chat app for young adults that connects strangers for ephemeral conversations through text, voice, and video messages. Think "Omegle meets Snapchat" with a fun, casual vibe.

## Core Concept
- Anonymous stranger chat with optional friend connections
- All messages are ephemeral (disappear after viewing)
- Simple E2E encryption for privacy
- Fun, young adult-focused branding
- Mobile-only (iOS and Android) - no web version

## Sprint Development Philosophy
**Iterative Delivery**: Ship valuable features every 1-2 weeks with continuous user feedback. Focus on time-boxed iterations that deliver complete, testable functionality.

## Sprint Structure
- **Sprint Length**: 1 week (7 days)
- **Sprint Ceremonies**: Planning (Mon), Daily Standups, Review (Fri), Retrospective (Fri)
- **Definition of Done**: Feature tested on both iOS/Android, documented, merged to main
- **Velocity Tracking**: Story points and completion rates tracked per sprint

## Sprint Backlog

### ✅ COMPLETED WORK
*All MVP and core features documented in CHANGELOG.md - representing approximately 15-20 sprints of work*

## COMPLETED SPRINT: Sprint N+1 (Week of August 5-8, 2025) ✅
### Sprint Goal: "Simplified Ephemeral Messaging - Better UX & Monetization" 🚀

**Actual Story Points Completed**: 10 points
**Sprint Theme**: Strategic simplification for better user experience and premium features
**Sprint Outcome**: Successfully completed all planned features plus additional read receipts fix

### Sprint Achievements:

#### HIGH PRIORITY (Must-Have) ✅ COMPLETED
- [x] **Simplify Ephemeral Messaging System** (5 points) ✅ COMPLETED
  - Remove complex timed message options (1min, 5min, 1hr, 24hr, 7days)
  - Simplify to just "View Once" and "Keep Permanently" options
  - Remove IntegratedCountdown and FallbackCountdown components
  - Fix persistent SVG useInsertionEffect warnings
  - Update ExpiryRuleSelector with cleaner two-option interface
  - Remove all countdown timer logic from message bubbles
  - Simplify EphemeralIndicator component (no more time tracking)
  
- [x] **Premium Feature Design** (2 points) ✅ COMPLETED
  - Design "Clear All Messages" premium feature
  - Add premium section to ExpiryRuleSelector modal
  - Create monetization opportunity with "clear on both devices" feature
  - Add screenshot blocking as future premium feature
  - Beautiful PRO badges and premium UI elements

#### COMPLETED FEATURES
- [x] **Double-Tap Reactions** (1 point) ✅ COMPLETED
  - Heart animation on message double-tap (sticky like Instagram/WhatsApp)
  - Persistent heart reactions that stay on messages
  - Haptic feedback integration
  - Toggle reaction on/off with double-tap

- [x] **Voice Message Error Cleanup** (0.5 point) ✅ COMPLETED
  - Reduced debug console logs for cleaner development experience
  - Improved error handling in audio encryption pipeline
  
- [x] **Message Read Receipts - FIXED** (3 points) ✅ COMPLETED
  - Complete re-implementation after initial system had issues
  - Visual status indicators working correctly: sending, sent, delivered, read
  - Single gray checkmark for sent, double gray for delivered
  - Double BLUE checkmarks (#007AFF) for read messages (fixed purple color issue)
  - Fixed checkmark overlap issue (adjusted from -12px to -7px for proper visibility)
  - Implemented polling-based synchronization (3-second intervals)
  - Fixed infinite loop bug where messages kept being marked as read
  - Persistent status across app backgrounding/foregrounding
  - Local state management prevents redundant database updates
  - Applied to all message types (text, voice, video)

### Sprint Retrospective:
**What Went Well:**
- Successfully simplified ephemeral messaging from 7 options to 2
- Fixed critical read receipts functionality with pragmatic approach
- Delivered double-tap reactions feature enhancing user engagement
- Maintained code quality despite technical challenges

**What Could Be Improved:**
- Initial read receipts implementation caused Supabase issues
- Need better testing infrastructure before database migrations
- Supabase real-time UPDATE events don't work - need workarounds

**Action Items:**
- Always test database migrations locally first
- Document Supabase limitations (UPDATE events) in CLAUDE.md
- Use polling as fallback when real-time features fail

---

## CURRENT SPRINT: Sprint N+2 (Starting August 9, 2025)
### Sprint Goal: "Screenshot Prevention & Security"

## UPCOMING SPRINTS (Next 3 weeks)

### Sprint N+2: Screenshot Prevention & Security
**Theme**: Complete ephemeral messaging trust model
- [ ] Screenshot detection/prevention implementation
- [ ] Trust indicators in UI
- [ ] Security audit and testing

### Sprint N+3: Account Recovery System  
**Theme**: User retention and account management
- [ ] Username + password recovery system
- [ ] Device migration workflow
- [ ] Account recovery UI flow

### Sprint N+4: Anonymous Chat Enhancements
**Theme**: Improve stranger matching experience  
- [ ] Better matching algorithm
- [ ] Skip/Next functionality
- [ ] Report/Block system implementation

---

## PRODUCT BACKLOG (Prioritized Features)

### Epic 1: Safety & Trust (Sprint N+2 - N+3)
**Business Value**: Critical for user safety and ephemeral messaging trust

#### Sprint N+2 Stories:
- [ ] **Screenshot Detection/Prevention** (5 points)
  - Android: FLAG_SECURE implementation  
  - iOS: screenshot detection with notifications
  - User education about screenshot policies
  - Trust indicators in ephemeral message UI

#### Sprint N+3 Stories:  
- [ ] **Report/Block System** (3 points)
  - Report user functionality
  - Block user with local storage
  - Safety guidelines and education

### Epic 2: User Retention (Sprint N+3 - N+4)
**Business Value**: Reduce churn and improve user lifetime value

#### Sprint N+3 Stories:
- [ ] **Account Recovery System** (8 points)
  - Username + password authentication
  - Device migration workflow  
  - Account recovery UI/UX
  - Security considerations for E2E encryption

#### Sprint N+4 Stories:
- [ ] **Enhanced Matching** (5 points)
  - Improved stranger matching algorithm
  - Skip/Next functionality
  - Connection quality metrics

### Epic 3: Premium Features (Sprint N+5 - N+6)
**Business Value**: Revenue generation and user segmentation

#### Sprint N+5 Stories:
- [ ] **Premium Tier Foundation** (5 points)
  - Payment integration (Apple Pay, Google Play)
  - Premium UI indicators
  - User tier management

#### Sprint N+6 Stories:
- [ ] **Premium Features** (8 points)
  - Gender filter (male/female/any)
  - Location filter (country/continent)
  - Premium user experience enhancements

### Epic 4: Polish & Launch Preparation (Sprint N+7 - N+8)
**Business Value**: Production readiness and user onboarding

#### Sprint N+7 Stories:
- [ ] **Onboarding Flow** (5 points)
  - Age verification (18+)
  - Community guidelines
  - Quick tutorial

#### Sprint N+8 Stories:
- [ ] **Performance & Analytics** (3 points)
  - Performance optimization
  - Analytics setup (anonymous usage metrics)
  - Connection indicators and error handling

---

## SPRINT CEREMONIES & GUIDELINES

### Sprint Planning (Every Monday, 1-2 hours)
**Participants**: Full development team
**Agenda**:
1. Review previous sprint velocity and outcomes
2. Prioritize backlog items based on business value
3. Break down user stories into development tasks  
4. Estimate story points using planning poker
5. Commit to sprint goal and backlog items
6. Identify dependencies and risks

### Daily Standups (Every day, 15 minutes)
**Format**: What I did / What I'm doing / Any blockers
**Focus**: Collaboration, impediment identification, progress sharing

### Sprint Review (Every Friday, 1 hour)  
**Participants**: Development team + stakeholders
**Agenda**:
1. Demo completed features on real devices
2. Review sprint goal achievement
3. Gather feedback on deliverables
4. Update product backlog based on feedback

### Sprint Retrospective (Every Friday, 1 hour)
**Focus**: Continuous improvement
**Format**: Start/Stop/Continue or What went well/What didn't/Action items
**Output**: Concrete action items for next sprint

### Definition of Done
**Technical Requirements**:
- [ ] Feature works on both iOS and Android
- [ ] Code reviewed and approved by team member
- [ ] Unit tests written and passing
- [ ] E2E encryption verified (if applicable)
- [ ] No console errors or warnings
- [ ] Performance tested on slower devices

**Documentation Requirements**:
- [ ] Feature documented in CHANGELOG.md
- [ ] User-facing changes documented
- [ ] Technical decisions documented in CLAUDE.md
- [ ] Breaking changes or migrations noted

**Quality Assurance**:
- [ ] Manual testing completed on both platforms
- [ ] Accessibility considerations addressed
- [ ] Error handling and edge cases tested
- [ ] Feature demonstrates on development build

---

## VELOCITY TRACKING & METRICS

### Sprint Metrics to Track:
- **Story Points Committed vs Completed**
- **Sprint Goal Achievement Rate**
- **Defect Rate (bugs found post-sprint)**
- **Cycle Time (story start to completion)**
- **Team Satisfaction Scores**

### Success Criteria:
- 80%+ sprint goal achievement rate
- Consistent velocity over 3+ sprints
- Decreasing defect rates over time
- High team satisfaction (4/5 or higher)

---

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

### Brand Identity
- **Core**: Fun, casual, young adult focused (18-25)
- **Personality**: Spontaneous, mysterious, playful
- **Tone**: Casual, friendly, never serious

### Visual Design - "Neon Nights" Theme (Recommended)
- **Primary Colors**: 
  - Electric Purple (#B026FF) - Main accent
  - Neon Pink (#FF1B8D) - Highlights
  - Cyber Blue (#00D9FF) - Secondary
  - Laser Green (#00FF88) - Success states
- **Dark Theme**: Rich black (#0A0A0F) with neon accents
- **Effects**: Glowing elements, gradient message bubbles, neon trails

### Interactions & Animations
- **Messages**: Spring physics, pop-in effects, dissolve on expiry
- **Recording**: Colorful waveforms, pulsing buttons, progress rings
- **Reactions**: Double-tap hearts, emoji explosions, haptic feedback
- **Transitions**: Smooth 60fps, elastic scrolling, ripple effects
- **Sound**: Subtle UI sounds for send/receive/reactions

### Key Differentiators from Snapchat
- More anonymous/mysterious aesthetic
- Neon cyberpunk vibes vs bright yellow
- Focus on ephemeral connections, not social network
- Glowing UI elements emphasizing temporary nature

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