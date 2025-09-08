# VanishVoice Migration Plan — From E2E to Regular Chat (Option A)

Purpose: Migrate the app away from end‑to‑end encryption to a simple, fun anonymous chat app with safe moderation, while keeping data encrypted in transit (HTTPS) and protected at rest by private storage buckets and standard server‑side encryption.

This plan is broken into implementable features and tasks that an AI agent (or developer) can execute. It also includes required documentation updates to remove the encryption promise and reposition the product.

---

## 0) Product Positioning & Documentation

Goal: Remove all “strong encryption” / “zero‑knowledge” claims and reposition the app as a fun anonymous chat app with safety tooling.

Tasks
- Update README and marketing copy:
  - Remove the encryption promise (e.g., “not even us”).
  - Emphasize “fun, voice/video/text with anonymous strangers,” moderation and safety.
- Remove/retire docs that position E2E/zero‑knowledge as core (or move to an appendix labeled “legacy concept – not active”).
- Add a short privacy note: “Content is accessible to our moderation team when reported. Data is transported over HTTPS and stored in private buckets.”

Files to update
- `README.md`: remove all E2E claims; add new positioning.
- `docs/security/*`: either delete or add disclaimers; link to this migration plan.
- `docs/development/Development_Roadmap.md`: reflect new direction.

---

## 1) Architecture (Option A — Simplest, Reviewable)

- In transit: HTTPS/TLS only (no app‑level encryption).
- Text: Store plaintext in DB (`messages.content`).
- Media (audio/video): Store raw files in private Supabase Storage buckets; access via short‑lived signed URLs.
- Moderation: Service‑role admin backend fetches text and generates signed URLs for media; all access audited.

No client‑side encryption keys, no server‑side app keys. Keep it simple, reviewable, and auditable.

---

## 2) Data Model Changes (DB)

Add delivery and lifecycle columns to `messages`:
- `delivered_at timestamptz`
- `expired_at timestamptz`
- `status text CHECK (status IN ('queued','sent','delivered','read','expired','deleted')) DEFAULT 'sent'`
- `under_review boolean DEFAULT false` (optional; set true when a report is opened)

Indexes
- `messages_deliverability_idx` on `(status, delivered_at, created_at)`
- `messages_media_path_idx` on `(media_path)` where not null

Moderation tables
- `reports(id, reporter_id, conversation_id, message_id, reason, status, created_at)`
- `review_audit(id, reviewer_id, report_id, conversation_id, scope jsonb, started_at, ended_at, created_at)`

Tasks (SQL)
- Add columns to messages and create indexes.
- Create `reports` and `review_audit` tables with RLS (users can create reports; only admins/service‑role can read all; reviewers write to audit).

---

## 3) Buckets & Access (Media)

Buckets
- Ensure media buckets (`voice-messages`, `videos`) are private (no public read).

Access
- Users access media by normal app flows.
- Moderators get signed URLs via admin service (TTL 5–15 minutes).

Tasks
- Verify bucket policies are private.
- Implement admin endpoints to generate signed URLs.

---

## 4) Admin/Moderation API

Purpose: Read reported conversations and media safely; audit everything.

Endpoints (service‑role protected)
- `POST /admin/reports/:id/begin` → create review session, write `review_audit` started_at; returns short‑lived review token.
- `GET /admin/reports/:id/conversation` → return messages for scope (requires valid review session).
- `POST /admin/media/signed-url` → body: `{ bucket, path, ttl }`; returns signed URL for review.
- `POST /admin/reports/:id/end` → closes session and writes `ended_at`.

Tasks
- Implement endpoints in Supabase Edge Functions or a small admin server.
- Ensure only service‑role key or admin JWT can call these endpoints.
- Append an immutable audit row per review session.

---

## 5) Client Changes — Sending & Receiving

Text
- Stop client‑side encryption; write plaintext to `messages.content`.
- Set `status='sent'` when inserted; mark `delivered_at`/`status='delivered'` when the recipient fetches/acknowledges.

Media (audio/video)
- Upload raw bytes with `supabase.storage.from(<bucket>).upload(path, data)`.
- Store `media_path` on the message row.

Delivery Acknowledgement
- On message fetch, client calls an endpoint/RPC to mark messages `delivered_at=now(), status='delivered'` (for that recipient and message ids).

View‑Once (optional)
- Keep the “view-once” UX: after client marks as viewed, the server can delete media file and/or mark as expired.

Tasks
- Remove calls to encryption wrappers (text/audio/video) and replace with direct DB insert + Storage upload.
- Implement delivery acknowledgement RPC.

---

## 6) Undelivered Cleanup Cron (Edge Function)

Goal: Delete undelivered messages after TTL (e.g., 48h) to reduce storage/DB clutter.

Strategy
- Two‑phase delete:
  - Soft expire: set `status='expired', expired_at=now()` when past TTL and `delivered_at IS NULL`.
  - Hard delete: after a grace (e.g., 12h), remove media (if any), then delete DB rows; insert rows into `deletion_log`.

Scheduling
- Run every 15–60 minutes via Supabase Scheduled Functions.

Tasks
- Implement Deno function:
  - Query batched undelivered messages past TTL.
  - Phase 1: expire; Phase 2: delete media, then DB row.
  - Skip `under_review=true` or `reports`‑linked rows.
  - Return counts; log to console and write to `deletion_log`.

---

## 7) RLS & Roles

- Users: RLS enforces access to their own messages.
- Admin/Moderation: use service role or admin JWT with policies that allow reading reported conversations and writing to `review_audit`.

Tasks
- Verify RLS policies for messages, reports, review audit.
- Ensure service‑role key is never shipped in the client.

---

## 8) Code Removal / Refactor

- Remove or archive E2E/zero‑knowledge modules and references:
  - `SharedSecretEncryption` usage and any XOR code paths.
  - Any “zero‑knowledge verification” menus and tests.
  - Keep basic encryption tests only if they verify TLS transport or are repurposed.
- Simplify send/receive code paths accordingly.

Files to audit (examples)
- `src/utils/secureE2EAudioStorage.ts`, `src/utils/secureE2EVideoStorage*`, `src/utils/NaCl*`, `src/utils/sharedSecretEncryption.ts`.
- Any screens that surface encryption status/UX.

---

## 9) Telemetry, Logging, Auditing

- Logging: no secrets; log message ids/counts only.
- Audit: `review_audit` entries for every review session (reviewer_id, report_id, conversation_id, scope, timestamps).
- Metrics: counts of messages expired/deleted; storage delete failures.

Tasks
- Add minimal metrics/logging to Edge Functions and admin endpoints.

---

## 10) QA & Rollout

QA checklist
- Send/receive text and media across devices; confirm plaintext DB, private media access, delivery ack.
- Reports workflow: create, begin review, list messages, get signed URLs, end review. Confirm audit rows recorded.
- Undelivered TTL: simulate old messages; cron marks expired and deletes (DB+media); no orphaned references.
- RLS: normal users cannot read others’ data; admin tool can read only through service‑role.

Rollout
- Deploy DB migrations.
- Ship client updates (remove encryption, add delivery ack).
- Enable scheduled cleanup function.
- Update documentation and store listings.

---

## 11) Concrete Task List (AI‑Agent Friendly)

DB (SQL/Migrations)
- [ ] Add `delivered_at`, `expired_at`, `status`, `under_review` to `messages`.
- [ ] Create `reports` and `review_audit` tables with necessary indexes and basic RLS.
- [ ] Create `deletion_log` table for hard‑delete auditing.
- [ ] Add helpful indexes: `messages_deliverability_idx`, `messages_media_path_idx`.

Buckets/Storage
- [ ] Verify buckets `voice-messages` and `videos` are private.

Admin API (Edge Functions)
- [ ] `POST /admin/reports/:id/begin` (start review session, write audit).
- [ ] `GET /admin/reports/:id/conversation` (return messages for scope).
- [ ] `POST /admin/media/signed-url` (generate signed URL).
- [ ] `POST /admin/reports/:id/end` (end review session, finalize audit).

Client (App)
- [ ] Replace text encryption calls with plaintext DB insert (status defaults to `sent`).
- [ ] Replace media encryption with direct Storage upload; store `media_path`.
- [ ] Implement delivery acknowledgement RPC; mark `delivered_at` and `status='delivered'`.
- [ ] (Optional) Keep view‑once UX: call server to delete media and mark expired after view.

Cleanup Cron (Edge Function)
- [ ] Implement TTL expire + hard delete for undelivered messages.
- [ ] Batch deletes and handle storage delete errors gracefully.

RLS & Security
- [ ] Ensure users can only read their own messages; service‑role bypass for admin endpoints.
- [ ] Ensure admin functions require service‑role key or admin JWT claims.

Docs & Positioning
- [ ] Remove encryption promise from README and docs.
- [ ] Add a short privacy/safety section describing moderation access.
- [ ] Update roadmap to reflect “fun anonymous chat” direction.

Deprecations
- [ ] Remove/disable E2E modules and “verification” UI.
- [ ] Remove tests that assert E2E behaviors; add tests for moderation flows instead.

---

## 12) Example SQL Snippets

Messages columns
```sql
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text
    CHECK (status IN ('queued','sent','delivered','read','expired','deleted'))
    DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS under_review boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS messages_deliverability_idx
  ON messages(status, delivered_at, created_at);

CREATE INDEX IF NOT EXISTS messages_media_path_idx
  ON messages(media_path) WHERE media_path IS NOT NULL;
```

Reports & review audit
```sql
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  conversation_id uuid,
  message_id uuid,
  reason text,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL,
  report_id uuid NOT NULL,
  conversation_id uuid,
  scope jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid,
  media_path text,
  reason text,
  created_at timestamptz DEFAULT now()
);
```

---

## 13) Example Delivery Acknowledgement (RPC)

```sql
CREATE OR REPLACE FUNCTION mark_messages_delivered(p_user_id uuid, p_message_ids uuid[])
RETURNS int AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE messages
     SET delivered_at = now(),
         status = 'delivered'
   WHERE recipient_id = p_user_id
     AND id = ANY(p_message_ids)
     AND delivered_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Client calls this after fetching messages to prevent the TTL job from expiring valid messages.

---

## 14) Example Cleanup Function (Pseudo‑Code)

- Query undelivered older than TTL (e.g., 48h) with `status IN ('queued','sent')`.
- Phase 1: `UPDATE … SET status='expired', expired_at=now()`.
- Phase 2: for expired older than GRACE (e.g., 12h):
  - If `media_path`, delete Storage object; if success → delete DB row; write `deletion_log`.
- Batch, log counts, and return JSON summary.

---

## 15) Backout Plan

- If issues arise, you can revert to the prior branch/tag where E2E was still present for dev/testing, but public releases should remain on the non‑E2E branch.
- Keep a feature flag to disable the TTL job if needed.

---

## 16) Final Notes

- This plan removes cryptographic complexity while keeping user safety and privacy controls (HTTPS, private storage, audits).
- Moderation access is tightly scoped and logged.
- The app can now focus on fast, fun anonymous chatting experiences.

