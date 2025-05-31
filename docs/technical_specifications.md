# Technical Specifications

### 1. Architecture Overview
\`\`\`
[Mobile Client (React Native/Expo)] ↔ [Backend API (Serverless) + BaaS]
                   \_ [Push Notifications]
                   \_ [Realtime DB / Storage]
\`\`\`

- **Mobile Client:** Expo-managed React Native app.
- **Backend:** Serverless functions (e.g., Vercel/Netlify functions or Supabase Edge Functions).
- **Database & Storage:** Supabase (PostgreSQL + Storage) for messages and media blobs.
- **Authentication:** Supabase Auth (email/password, OAuth) with anonymous guest login support.
- **Push Notifications:** Expo Push Notifications service.

### 2. Front-End Stack

- **Framework:** React Native via Expo.
- **Languages:** TypeScript, React Hooks.
- **UI Components:**
  - Custom mic-button with animated press feedback.
  - Waveform visualization using `react-native-audio-toolkit` or similar.
  - Contextual modals for expiry settings.
- **State Management:** React Context + Zustand (lightweight store).
- **Networking:** `fetch` or `axios` for REST calls; optional `graphql-request` if GraphQL chosen.
- **Encryption:** Use `tweetnacl` or `react-native-crypto` for client-side AES-256 media encryption.
- **Push:** Expo Notifications API integrated via `expo-notifications`.

### 3. Back-End Stack

- **Platform:** Supabase
  - **Database:** PostgreSQL for message metadata and user profiles.
  - **Storage:** Supabase Storage for encrypted media files.
  - **Auth:** Supabase Auth for user identities and anonymous sessions.
  - **Realtime:** Supabase Realtime for live room and message state.
  - **Edge Functions:** JavaScript/TypeScript for message lifecycle logic (expiry, delete triggers, consent flow).

- **Serverless Functions (optional):** Vercel or Netlify Functions for custom API endpoints (if needed beyond Supabase Edge Functions).

### 4. Data Models

\`\`\`sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  anon_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  sender_id UUID REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  media_path TEXT NOT NULL,
  expiry_rule JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  listened_at TIMESTAMP,
  expired BOOLEAN DEFAULT false
);
\`\`\`

- **expiry_rule** JSON example: `{ "type": "time", "duration_sec": 60 }`, or `{ "type": "geo", "radius_m": 100, "lat": 59.437, "lng": 24.7536 }`, or `{ "type": "event", "event_id": "abc123" }`.

### 5. APIs

| Endpoint                     | Method | Description                                    |
|------------------------------|--------|------------------------------------------------|
| \`/api/register\`              | POST   | Create guest or registered user               |
| \`/api/send-message\`          | POST   | Upload encrypted voice clip, create metadata  |
| \`/api/listen-message/{id}\`   | GET    | Fetch and decrypt message, mark listened_at   |
| \`/api/expiry-check\`          | POST   | Edge function to evaluate and expire messages |
| \`/api/request-save/{id}\`     | POST   | Recipient requests save; notify sender        |
| \`/api/approve-save/{id}\`     | POST   | Sender approves save; update message record   |

### 6. Security & Privacy

- **Encryption:** Client-side encryption of voice blobs; server stores only ciphertext.
- **Transport:** HTTPS for all API calls.
- **Access Control:** Row-level security in Supabase; policies to ensure only sender/recipient access.
- **Metadata Purge:** Scheduled Edge Function runs every minute to delete expired media files from Storage and mark records.

### 7. Deployment & CI/CD

- **Front-End:** Expo EAS for build and release (iOS/Android).
- **Back-End:** Supabase managed; Edge Functions deploy via GitHub Actions.
- **Testing:** Jest + React Native Testing Library for front-end; integration tests in Supabase using pgTAP or direct SQL.
- **CD:** GitHub Actions pipelines:
1. Lint & unit tests (both FE & BE)
2. Deploy Edge Functions
3. Trigger Expo EAS build for staging
4. On merge to `main`, deploy production builds and run DB migrations

### 8. Monitoring & Analytics

- **Crash Reporting:** Sentry for React Native.
- **Usage Analytics:** PostHog (self-hosted or cloud) for event tracking (message sends, listens, expiry events).
- **Alerts:** Supabase Metrics + PagerDuty integration for storage or RLS failures.

*This document outlines the foundational plan for developing and launching our ephemeral voice chat app. Adjust components as the team evaluates trade-offs and user feedback.*
