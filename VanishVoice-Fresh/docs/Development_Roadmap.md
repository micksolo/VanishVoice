# VanishVoice — Development Roadmap

## Project Overview
**VanishVoice** is an anonymous chat app that connects strangers for fun, lightweight conversations via text, voice, and video. We are migrating away from app‑level end‑to‑end encryption to a simpler, reviewable architecture focused on safety, moderation, and great UX.

## Core Features
- Anonymous stranger chat with optional friend connections
- Ephemeral messaging (view‑once and TTL options)
- Private media storage with signed URL access
- Reporting and moderation with audit trails
- Mobile‑only (iOS and Android)

## Development Focus
**Fun‑First + Safety**: Prioritize delightful chat experiences and strong moderation/safety, with simple, transparent data handling (HTTPS in transit, private storage at rest).

## Current Status
### ✅ Foundation
**Core Platform**: ✅ Anonymous chat, voice/video messages, friend system
**Infrastructure**: ✅ Supabase (DB/Storage/Functions/Realtime), push notifications, dev builds

## NEXT PRIORITY: VanishVoice Codebase Migration Plan
  Overview

  Migrate from the old problematic VanishVoice codebase to the working VanishVoice-Fresh implementation. Since
   git history isn't important, we'll go with the cleaner fresh start approach.

  Phase 1: Full Feature Testing (30 min)

  1. Test Core Authentication:
    - Anonymous user creation
    - User profiles and friend codes
  2. Test Friend System:
    - Adding friends by code
    - Friend requests (send/accept/reject)
    - Friend removal and re-adding
  3. Test Chat Features:
    - Text messaging between friends
    - Voice message recording/playback
    - Video message recording/playback
    - Message status indicators (sent/delivered/read)
  4. Test Encryption:
    - End-to-end message encryption
    - Device key generation and storage
    - Message decryption on recipient device
  5. Test Ephemeral Features:
    - View-once messages
    - Message expiry rules
    - Automatic message clearing

  Phase 2: Clean Migration Strategy (20 min)

  Approach: Fresh Repository (Simpler)
  1. Create new GitHub repository named VanishVoice
  2. Initialize from VanishVoice-Fresh directory
  3. Update project configuration:
    - Remove "-Fresh" from all names
    - Update bundle identifiers
    - Clean up any temporary files
  4. Set up fresh git history

  Phase 3: Project Cleanup (15 min)

  1. Update package.json:
    - Change name from "vanishvoice" to proper naming
    - Verify all dependencies are correct
  2. Update app.json:
    - Remove "-Fresh" from app name and slug
    - Clean up bundle identifiers
  3. Clean temporary files:
    - Remove any test files
    - Remove backup files (.bak)
    - Remove debugging utilities if not needed
  4. Verify builds work:
    - Test Expo Go development
    - Test EAS development builds

  Phase 4: Repository Setup (10 min)

  1. Archive old VanishVoice repo (or delete if you prefer)
  2. Create new VanishVoice repository
  3. Push clean VanishVoice-Fresh as new main branch
  4. Update any deployment configurations
  5. Test clone and setup on fresh environment

  Benefits of Fresh Start:

  - ✅ No legacy Metro/build issues
  - ✅ Clean git history without migration artifacts
  - ✅ Simplified project structure
  - ✅ No confusion about which codebase is current
  - ✅ Fresh start for team members



## NEXT PRIORITY: Migrate to Regular Chat (Option A)
We will proceed with the plan in `docs/Migration_Plan_Regular_Chat.md`.

Summary of work (high‑level):
- Product/Docs: Remove the “encryption promise” from README/docs; add a plain privacy note.
- Data Model: Add `status`, `delivered_at`, `expired_at` to `messages`; create `reports` and `review_audit` with indexes.
- Media Buckets: Ensure private buckets; serve media with short‑lived signed URLs.
- Admin/Moderation API: Begin/end review (audit), fetch conversation, generate signed URLs (service‑role only).
- Client: Store text as plaintext; upload raw media and persist `media_path`; implement delivery acknowledgement RPC; optional view‑once server cleanup.
- Cleanup Cron: Two‑phase delete of undelivered (soft expire, then hard delete with storage removal + `deletion_log`).
- RLS & Roles: Users read only their own messages; admin endpoints require service role/admin JWT.
- Deprecations: Remove/disable E2E/zero‑knowledge modules, tests, and UI; simplify send/receive flows.
- QA & Rollout: Validate chat flows, moderation, TTL cleanup, RLS boundaries; update store listings.

## Technical Foundation
**Frontend**: React Native (Expo) — iOS & Android  
**Backend**: Supabase (PostgreSQL + Edge Functions + Realtime + Storage)  
**Data Handling**: HTTPS/TLS in transit; text in DB; media in private Storage buckets; moderation via audited admin endpoints.  
**Push Notifications**: Expo Push Service (verify/enhance as needed)  
**Payments**: Native IAP (Apple Pay/Google Play) — optional, per roadmap  
**Analytics**: Replace Sentry with privacy‑aware analytics as needed

## Monetization (Optional Next)
If/when we pursue monetization:
- Premium discovery filters (age/gender/location) with clear UX and legal compliance
- Payment integration (IAP), tier tracking, and feature enforcement
- Safety‑focused premium features (e.g., enhanced trust indicators)

## Launch Readiness Checklist
- Core chat flows stable (text, media)
- Moderation endpoints + audit in place
- Undelivered cleanup cron active
- Documentation updated (no encryption promise; new positioning)
- RLS verified: users cannot read others’ data

## NEXT STEPS — Implementation (Top Items)
1) Apply DB migrations for `messages` lifecycle fields, `reports`, `review_audit`, `deletion_log`.  
2) Set buckets to private; add admin endpoints for signed URLs and review sessions.  
3) Update client: plaintext text; direct media upload; delivery acknowledgement RPC; optional view‑once cleanup.  
4) Implement scheduled cleanup function for undelivered messages (two‑phase).  
5) Update README and docs (remove encryption promise; link migration plan).  

## Success Metrics
- Delivery success rate and time‑to‑deliver
- Report workflow usage and audit coverage
- Cleanup job effectiveness (expired/deleted counts; no orphans)
- User engagement (DAU/WAU, session length)
