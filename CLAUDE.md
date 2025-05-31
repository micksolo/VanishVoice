# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VanishVoice is an ephemeral voice messaging app built with React Native (Expo) and Supabase. Messages auto-expire based on time, location, or events, with end-to-end encryption and mutual-consent saving capabilities.

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