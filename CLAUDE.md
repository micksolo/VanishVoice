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

## Mobile Testing Infrastructure

**MCP Mobile Testing**: All agents have access to mobile device testing via MCP mobile server.

### Setup Requirements
- MCP mobile server configured in `~/.claude.json`
- See `MOBILE_TESTING_PLAYBOOK.md` for complete procedures

### Device Testing Rules (MANDATORY)
- **iOS Testing**: MUST use iPhone SE 3rd generation simulator (NOT iPhone SE 2nd generation)
- **Android Testing**: Use emulator-5554 or available Android emulator
- **Device Selection**: Always verify device selection before testing
- **Exclusion Rule**: iPhone SE 2nd generation is reserved for other Claude sessions

### Core Testing Commands
```bash
# Launch VanishVoice app for testing
mcp__mobile-mcp__mobile_launch_app("host.exp.Exponent")

# Take screenshot for visual verification
mcp__mobile-mcp__mobile_take_screenshot()

# List interactive elements with coordinates
mcp__mobile-mcp__mobile_list_elements_on_screen()

# Test user interactions
mcp__mobile-mcp__mobile_click_on_screen_at_coordinates(x, y)
```

### When to Use Mobile Testing
- **vv-engineer**: Validate technical implementations on real devices
- **vv-designer**: Test UI/UX changes immediately after implementation
- **monetization-specialist**: Verify premium flows and conversion funnels
- **All agents**: Before marking features as complete

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

**DIRECT AGENT ACCESS**: Users can work directly with specialized agents based on their needs. Each agent has specific expertise and responsibilities.

**Available Agents**:
- **vv-engineer**: Technical implementation, architecture, and code development
- **vv-designer**: UI/UX design, user experience, and visual design systems
- **monetization-specialist**: Revenue optimization, premium features, and conversion strategies
- **vv-mobile-tester**: Mobile app testing specialist using MCP infrastructure for regression testing, performance monitoring, and multi-device validation

**User Experience**:
- Work directly with the agent that matches your current need
- Each agent maintains their domain expertise
- Agents can coordinate when cross-functional work is needed
- Clear, focused responses from domain experts

**Benefits**:
- Streamlined communication and better project continuity
- Coordinated solutions considering all aspects (technical, design, process)
- Consistent documentation updates across all project files
- Single source of truth for project decisions and context

The vv-pm agent will:
1. Analyze each request and determine required expertise
2. Coordinate with appropriate specialized agents internally
3. Synthesize responses that incorporate all relevant perspectives
4. Ensure comprehensive solutions and proper documentation updates
5. Maintain full project context and decision history

**For bug fixes and feature improvements**: vv-pm coordinates the full solution (analysis, implementation, testing, documentation) to provide complete responses.

To work directly with Claude Code without agent coordination, users can explicitly state "without agents" or "no agents" in their request.

## Agent Workflow & Guidelines

### When to Use Each Agent

#### vv-engineer (Technical Implementation) - Code Specialist
**PRIMARY USE**: Technical implementation and architecture decisions
**INVOKE WHEN**:
- Implementing specific features or bug fixes
- Technical architecture decisions
- Code reviews and technical debt management
- Platform-specific technical challenges
- Integration with third-party services

**EXAMPLES**:
- "Implement E2E encryption for video messages"
- "Fix the dark theme issues in chat screen"
- "Optimize video compression performance"
- "Integrate Supabase realtime for live chat"

#### vv-designer (UI/UX Design) - Design Specialist
**PRIMARY USE**: User experience and visual design decisions
**INVOKE WHEN**:
- UI/UX design challenges
- User flow optimization
- Visual design system updates
- Accessibility improvements
- User research and usability testing

**EXAMPLES**:
- "Design the onboarding flow"
- "Improve the recording UI experience"
- "Create a consistent design system"
- "Make the app more accessible"

### Agent Collaboration Patterns

#### Pattern 1: Strategic → Sprint → Implementation
```
User Request → vv-pm → vv-sprint-master → vv-engineer/vv-designer
```
**When**: Large features requiring sprint planning
**Example**: "Add premium subscription system"
1. vv-pm breaks down into phases and coordinates overall strategy
2. vv-sprint-master plans specific sprints and estimates work
3. vv-engineer implements backend; vv-designer creates UI

#### Pattern 2: Sprint Focus → Direct Implementation
```
User Request → vv-sprint-master → vv-engineer/vv-designer
```
**When**: Sprint-specific work that doesn't need strategic coordination
**Example**: "Plan this week's sprint with the video compression fixes"
1. vv-sprint-master plans sprint and estimates stories
2. vv-engineer implements technical solutions

#### Pattern 3: Direct Implementation
```
User Request → vv-engineer OR vv-designer
```
**When**: Single-component work within current sprint
**Example**: "Fix the dark theme colors in settings screen"
1. vv-engineer directly implements the fix

### Agent Handoff Protocol

**FROM vv-pm TO vv-sprint-master**:
- High-level features broken into epic-sized chunks
- Business value and user impact defined
- Technical dependencies identified
- Ready for sprint sizing and planning

**FROM vv-sprint-master TO vv-engineer/vv-designer**:
- Stories sized and estimated with story points
- Acceptance criteria clearly defined
- Dependencies and risks identified
- Sprint commitment made with clear deliverables

**FROM vv-engineer/vv-designer TO vv-sprint-master**:
- Implementation complete with testing done
- Any scope changes or blockers communicated
- Ready for sprint review and retrospective

**FROM vv-sprint-master TO vv-pm**:
- Sprint goals achieved or variance explained
- Velocity data updated
- Long-term impacts or strategic insights identified

### Agent Selection Decision Matrix

| User Request Type | Primary Agent | Secondary Agent | Reasoning |
|------------------|---------------|----------------|-----------|
| "Plan next sprint" | vv-sprint-master | - | Sprint-specific planning |
| "Add payment system" | vv-pm | vv-sprint-master → vv-engineer | Strategic feature requiring coordination |
| "Fix dark theme bug" | vv-engineer | - | Direct technical implementation |
| "Improve onboarding UX" | vv-designer | vv-pm (if cross-platform) | UX-focused work |
| "We're behind on sprint goals" | vv-sprint-master | - | Sprint execution issue |
| "Plan roadmap for Q2" | vv-pm | vv-sprint-master | Strategic planning |
| "Run retrospective" | vv-sprint-master | - | Sprint ceremony |
| "Estimate video feature" | vv-sprint-master | vv-engineer (for technical input) | Story estimation |
| "Optimize app performance" | vv-engineer | vv-pm (if affects roadmap) | Technical optimization |
| "Design premium tier UI" | vv-designer | vv-pm (for business requirements) | UI design work |

### Common User Scenarios & Agent Routing

#### Scenario 1: "Let's start working on the premium features"
**Route**: User → vv-pm → vv-sprint-master → vv-engineer + vv-designer
**Why**: Strategic feature requiring coordination, sprint planning, and both technical + design work

#### Scenario 2: "Our last sprint didn't go well, what happened?"
**Route**: User → vv-sprint-master
**Why**: Sprint execution analysis and retrospective work

#### Scenario 3: "The video recording is crashing on Android"
**Route**: User → vv-engineer  
**Why**: Platform-specific technical bug

#### Scenario 4: "How should we approach user authentication?"
**Route**: User → vv-pm → vv-sprint-master → vv-engineer
**Why**: Strategic decision requiring planning and technical implementation

#### Scenario 5: "Plan this week's work with the chat improvements"
**Route**: User → vv-sprint-master → vv-engineer/vv-designer
**Why**: Sprint-specific planning for defined scope

## Development Process

### Agent Team Structure
- **vv-engineer**: Technical implementation, code quality, and architecture decisions
- **vv-designer**: UI/UX design, user experience, and visual design systems
- **monetization-specialist**: Revenue optimization, premium features, and conversion tracking
- **vv-mobile-tester**: Dedicated mobile app testing using MCP infrastructure, regression testing, performance monitoring, and multi-device validation

### Sprint Workflow
**Sprint Length**: 1 week (7 days)
**Sprint Goal**: Each sprint must have a clear, achievable goal that delivers user value

#### Sprint Ceremonies (vv-sprint-master Responsibilities):

1. **Sprint Planning** (Monday, 1-2 hours) - **FACILITATED BY vv-sprint-master**
   - Review previous sprint velocity and completion rate
   - Prioritize backlog items by business value and technical dependencies
   - Break down user stories into development tasks with clear acceptance criteria
   - Estimate story points using relative sizing (1, 2, 3, 5, 8, 13)
   - Commit to sprint goal and backlog items within team velocity
   - Identify risks, dependencies, and mitigation strategies
   - Create sprint plan with 10-20% buffer for unknowns

2. **Daily Standups** (Every day, 15 minutes) - **MANAGED BY vv-sprint-master**
   - Track progress against sprint commitments
   - Identify and escalate blockers immediately
   - Adjust sprint scope if impediments arise
   - Keep discussions tactical and time-boxed
   - Update velocity projections in real-time

3. **Sprint Review** (Friday, 1 hour) - **FACILITATED BY vv-sprint-master**
   - Demo completed features on real devices (iOS/Android)
   - Measure sprint goal achievement percentage
   - Gather stakeholder feedback and update backlog
   - Calculate actual velocity vs planned velocity
   - Identify trends affecting team performance

4. **Sprint Retrospective** (Friday, 1 hour) - **LED BY vv-sprint-master**
   - Use structured retrospective formats (Start/Stop/Continue, etc.)
   - Document what went well, what didn't, and lessons learned
   - Create concrete action items with owners and due dates
   - Track improvement trends over time
   - Update team processes and CLAUDE.md with learnings

#### vv-sprint-master Continuous Responsibilities:
- **Impediment Removal**: Actively identify and resolve blockers
- **Velocity Tracking**: Monitor and report on team performance metrics
- **Scope Management**: Adjust sprint commitments based on capacity changes
- **Process Improvement**: Implement lessons learned from retrospectives
- **Documentation**: Keep Development_Roadmap.md current with sprint progress

### Sprint Documentation Requirements:
- **Development_Roadmap.md**: Contains current sprint, upcoming sprints, and product backlog
- **CHANGELOG.md**: Updated with completed features after each sprint
- **Sprint Retrospective Reports**: Track what worked, what didn't, and improvement actions
- **Velocity Tracking**: Monitor story points and sprint goal achievement rates

### Definition of Done (Sprint Level):
**Technical Requirements**:
- Feature works on both iOS and Android platforms
- Code reviewed and approved by team member
- Unit tests written and passing (where applicable)
- E2E encryption verified for messaging features
- No console errors or warnings
- Performance tested on slower devices

**Mobile Testing Requirements** (MANDATORY):
- ✅ **MCP Mobile Testing Completed**: All features tested on actual devices using MCP mobile tools
- ✅ **UI/UX Validation**: Visual and interaction testing verified on target devices
- ✅ **Cross-Device Testing**: Multi-user features tested between devices (if applicable)
- ✅ **Performance Baseline Met**: App meets performance standards defined in MOBILE_TESTING_PLAYBOOK.md
- ✅ **Navigation Flow Verified**: All user flows tested end-to-end on mobile devices
- ✅ **Accessibility Testing**: Screen reader and accessibility features verified on mobile

**Documentation Requirements**:
- Feature documented in CHANGELOG.md
- User-facing changes documented
- Technical decisions documented in CLAUDE.md
- Breaking changes or migrations noted
- Mobile testing results documented (screenshots, performance metrics)

**Quality Assurance**:
- Manual testing completed on both platforms
- Accessibility considerations addressed
- Error handling and edge cases tested
- Feature demonstrates properly on development build
- **Mobile regression tests pass**: Core app functionality verified via MCP mobile testing

### Sprint Success Metrics:
- 80%+ sprint goal achievement rate
- Consistent velocity over 3+ sprints  
- Decreasing defect rates over time
- High team satisfaction (4/5 or higher)
- User value delivered each sprint

## Security Requirements (MANDATORY) - "NO ONE CAN SEE YOUR MESSAGES, EXCEPT YOU. NOT EVEN US."

### ABSOLUTE SECURITY RULE
**VanishVoice's core promise is that NO ONE - including the development team, server administrators, or anyone with database access - can read user messages. This is not negotiable and overrides ALL other considerations.**

### Zero-Knowledge Encryption Requirements
**ALL content sent between users MUST use true end-to-end encryption where the server CANNOT derive decryption keys:**

1. **Friend Messages**: Use `nacl.box` public-key encryption with device-specific keypairs
2. **Anonymous Messages**: Use verified key exchange with TOFU or key fingerprint verification
3. **Media Files**: Use authenticated encryption (`nacl.secretbox`) with per-message keys
4. **Keys Storage**: Private keys ONLY in secure hardware (Keychain/Keystore), never AsyncStorage
5. **Server Role**: Server is a relay only - can route encrypted data but never decrypt it

### CRITICAL: Server-Derivable Encryption is FORBIDDEN
**These patterns are BANNED and must never be used:**
- ❌ Keys derived from user IDs (server knows user IDs)
- ❌ Shared secrets computed from known values  
- ❌ Any encryption where server can recreate the decryption key
- ❌ Deterministic key generation from user-controlled data

### Implementation Requirements (MANDATORY FOR ALL FEATURES)

**Before implementing ANY feature that handles user content:**

1. **Verify Zero-Knowledge**: Confirm the server cannot derive decryption keys under any circumstances
2. **Use Proper Crypto**: Only use `nacl.box` (public-key) or `nacl.secretbox` (authenticated symmetric) 
3. **Secure Key Storage**: Private keys MUST use react-native-keychain, never AsyncStorage
4. **No Secret Logging**: Never log keys, nonces, session data, or any cryptographic material
5. **Key Verification**: Provide user-verifiable key authenticity (especially anonymous chat)
6. **Immediate Deletion**: Ephemeral content deleted server-side immediately after viewing

### Current Status (REQUIRES REMEDIATION)
- ❌ **BROKEN**: Friend messages use server-derivable SharedSecretEncryption (CRITICAL)
- ❌ **BROKEN**: Anonymous chat vulnerable to MITM (keys unverified) (CRITICAL)
- ❌ **BROKEN**: Audio uses XOR without authentication (HIGH)
- ❌ **BROKEN**: Keys stored in AsyncStorage (HIGH)
- ❌ **BROKEN**: Secrets logged in multiple files (HIGH)

### Remediation Priority
1. Replace friend chat encryption with `nacl.box` + device keypairs
2. Add key verification to anonymous chat (TOFU or fingerprint checking)
3. Replace audio XOR with `nacl.secretbox` 
4. Move all keys to secure hardware storage
5. Remove ALL secret logging from codebase
6. Implement immediate server-side deletion for ephemeral content

### Agent Responsibilities
**ALL agents must enforce this security model:**
- **vv-engineer**: Implement only zero-knowledge encryption patterns
- **vv-designer**: Design UX that supports key verification and security indicators
- **monetization-specialist**: Ensure monetization never compromises zero-knowledge principle
- **vv-mobile-tester**: Test security features and verify no plaintext leakage

### Compliance Testing
Before ANY security-related feature is marked complete:
1. **Server Access Test**: Verify server/database admins cannot read message content
2. **Key Derivation Test**: Confirm server cannot recreate any user decryption keys  
3. **Logging Audit**: Ensure no secrets appear in logs or crash reports
4. **Storage Audit**: Verify no private keys in AsyncStorage or unsecured locations

### No Shortcuts Policy
**Security shortcuts are absolutely forbidden.** Better to:
- Delay launch until security is correct
- Remove features that cannot be implemented securely
- Reject any implementation that compromises zero-knowledge principle

**The promise "not even us" means exactly that - we implement systems where we genuinely cannot access user content, even if we wanted to.**

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

### Screenshot Prevention Implementation COMPLETE (August 2025) ✅
- **Platform Limitations**: iOS cannot prevent screenshots, only detect them via expo-screen-capture
- **Android FLAG_SECURE**: Successfully implemented with complete native module for screenshot blocking
- **Expo Config Plugins**: Confirmed as best way to modify native code in managed Expo projects
- **Native Module Structure**: Successfully created separate implementations for iOS (stub) and Android (actual)
- **Security UI/UX**: Visual indicators successfully implemented to show protection level differences
- **Premium Differentiation**: Platform-specific features create clear value proposition for monetization
- **User Education**: Essential to explain why security features differ between platforms
- **Testing Strategy**: Development builds successfully created and operational for native module testing
- **Module Architecture SUCCESS**: 
  - ✅ TypeScript interface implemented for JavaScript side
  - ✅ Mock implemented for when native module unavailable
  - ✅ Android Java implementation complete with runtime toggle
  - ✅ iOS stub implementation for API consistency
  - ✅ Expo config plugin enabled and working
- **Security Context**: Global state management for security preferences and premium status
- **Onboarding Flow**: Multi-step carousel helps users understand security features
- **Production Ready**: Complete FLAG_SECURE implementation ready for app store deployment
- **Development Builds**: Both platforms operational (Android: a8c62c55, iOS: d06b88eb)
- **Key Achievement**: Android users can now completely prevent screenshots when premium feature is enabled

### Voice Message Implementation
- **Platform Differences**: iOS and Android handle audio differently. Always test on both platforms.
- **File Formats**: Use .mp4 for better cross-platform compatibility (not .mp3)
- **Audio Configuration**: Avoid iOS-specific settings like `interruptionModeIOS` when not needed
- **Recording Presets**: Use `Audio.RecordingOptionsPresets.HIGH_QUALITY` for best compatibility

### Ephemeral Messaging Strategic Pivot (August 2025)
- **Simplicity Wins**: Complex timed options (7 different time settings) confused users and caused technical issues
- **SVG Warning Resolution**: IntegratedCountdown component with react-native-svg caused persistent useInsertionEffect warnings
- **User Behavior**: Most users want either "view once" or "keep forever" - middle options rarely used
- **Monetization Opportunity**: Premium "clear on both devices" feature creates revenue potential
- **Technical Debt**: Countdown timers added significant complexity for minimal user value
- **UX Improvement**: Two clear options ("View Once", "Keep Permanently") are more intuitive than seven
- **Performance**: Removing countdown logic improves render performance and eliminates animation warnings
- **Solution**: Embrace simplification - sometimes fewer features create better user experience

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

### Expo Go vs Development Builds
- **Crypto Operations**: TweetNaCl requires `react-native-get-random-values` polyfill which must be imported at app entry point
- **PRNG Errors**: "no PRNG" errors in Expo Go are caused by missing polyfill import - fixed by adding `import 'react-native-get-random-values';` to App.tsx
- **Video Encryption**: Works in Expo Go after PRNG fix, but development builds provide better performance and reliability
- **Native Modules**: Development builds required for modules like react-native-compressor
- **Testing Strategy**: Test core functionality in Expo Go, use development builds for full feature testing
- **Production**: Always use production builds (EAS Build) for app store releases

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

### Agent Orchestration Lessons
- **Sprint-Master Role**: Essential for maintaining sprint discipline and velocity tracking
- **Clear Handoffs**: Define specific deliverables when passing work between agents
- **Agent Selection**: Use decision matrix to route requests to appropriate specialist
- **Ceremony Facilitation**: vv-sprint-master ensures structured agile practices
- **Impediment Tracking**: Sprint-master actively removes blockers to maintain momentum
- **Documentation Flow**: Each agent updates relevant docs (roadmap, changelog, CLAUDE.md)
- **Velocity Focus**: Sprint-master monitors team performance and identifies improvement opportunities

### Critical Orchestration Violation (August 2025)
- **What Happened**: Claude Code violated mandatory orchestration rule by implementing read receipts directly
- **Impact**: Created implementation without design specs, user complained about spacing issues
- **Resolution Process**: vv-pm coordinated proper re-implementation through agent team
- **Lesson**: NEVER bypass agent orchestration - always use vv-pm as single point of contact
- **Prevention**: vv-pm must immediately flag and coordinate any direct implementation attempts
- **Best Practice**: All feature work requires: design specs → technical planning → coordinated implementation

### Supabase Real-time Limitations (August 8, 2025)
- **Critical Issue**: Supabase real-time UPDATE events do NOT work reliably
- **Discovery**: Despite subscriptions showing SUBSCRIBED status, UPDATE events never fire
- **Impact**: Read receipts couldn't update in real-time when messages were marked as read
- **Solution**: Implement polling as fallback (3-second intervals for active chats)
- **Performance**: Polling is acceptable for active chat screens, disable when backgrounded
- **Best Practice**: Always have fallback mechanism for real-time features
- **Testing**: Verify real-time events actually fire, don't trust subscription status alone

### Read Receipts Implementation (August 8, 2025)
- **Checkmark Spacing**: Use -7px margin for second checkmark (WhatsApp-style overlap)
- **Color Standards**: Use #007AFF (iOS blue) for read receipts, not app accent color
- **Status Progression**: sending → sent → delivered → read (skip delivered if read quickly)
- **Local State**: Update local state immediately after database updates to prevent loops
- **Polling Strategy**: Only poll when chat screen is focused and active
- **Database Design**: Simple read_at timestamp sufficient, no complex tables needed
- **Migration Caution**: Test ALL database migrations locally before production

### Native Module Development Best Practices (August 2025)
- **Expo Config Plugins**: Essential for managed workflow native module integration
- **Development Builds**: Required for testing native modules - cannot use Expo Go
- **Cross-Platform API**: Always implement consistent TypeScript interface across platforms
- **Platform-Specific Implementation**: Android can have full functionality, iOS may have limitations
- **Runtime Toggles**: Implement feature toggles for premium/subscription-based native features
- **Mock Implementations**: Provide fallbacks when native modules unavailable (development)
- **Build Management**: Use EAS Build for consistent development build creation
- **Testing Strategy**: Always test on both platforms before considering complete
- **Plugin Configuration**: Enable plugins in app.config.js for proper native code integration
- always use   eas build --platform ios --profile development-device for development builds (we never us simulator for development builds)