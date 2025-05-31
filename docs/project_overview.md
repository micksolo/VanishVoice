# Project Overview

**App Name (TBD)**: VanishVoice (placeholder)

**Vision:**
Create a playful, voice-first ephemeral messaging app where users send "listen-once" voice clips that auto-expire based on time, location, or events, and can be mutually saved by consent.

**Objectives:**
- Enable seamless, one-tap recording and playback of voice messages.
- Offer contextual expiry: time-based, geo-triggered, or calendar-event-driven deletion.
- Provide end-to-end encryption with metadata purge upon message expiry.
- Implement a lightweight, intuitive UI powered by React Native (Expo).
- Support mutual-consent saving: recipients can request saves during playback.
- Ensure scalability and maintainability using a managed backend service.

**Key Features:**
1. **Voice Snaps**: Record and send voice messages that play once and self-destruct.
2. **Contextual Expiry Rules**: Choose expiry based on:
   - _Time_: X seconds/minutes/hours/days after sending or first listen.
   - _Location_: Delete on exit from a defined geofence.
   - _Event_: Auto-expire when a linked calendar event ends.
3. **Mutual-Consent Save**: In-session prompt allows recipient to request a save; sender can approve 1-time replay or permanent save.
4. **End-to-End Encryption**: AES-256 encryption of media and metadata; automatic wipe on expiry.
5. **Playful UI**: Big mic-button, waveform playback, ephemeral IDs (no usernames).
6. **Anonymous Stranger Connect**: Users can tap a “Random Connect” button to be paired anonymously with another online user for an impromptu 1:1 voice chat, preserving the same ephemeral and contextual deletion rules.

**Target Platforms:**
- iOS and Android (via Expo React Native)

**Timeline & Milestones:**
| Phase                 | Deliverables                                  | Duration    |
|-----------------------|-----------------------------------------------|-------------|
| Planning & Design     | UI/UX designs, data models, API contracts      | 2 weeks     |
| MVP Development       | Core voice chat, expiry rules, encryption      | 8 weeks     |
| Beta & Testing        | Closed beta, feedback integration              | 4 weeks     |
| Public Launch         | App Store & Play Store release, marketing kick | 2 weeks     |
| Post-Launch Iteration | Feature enhancements, performance tuning       | Ongoing     |
