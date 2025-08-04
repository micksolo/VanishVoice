# VanishVoice 👻🎙️

A secure ephemeral voice messaging app with military-grade end-to-end encryption. Messages vanish after being heard, leaving no trace.

## 🔐 Security First

VanishVoice uses **NaCl (Networking and Cryptography library)** for end-to-end encryption, the same cryptographic foundation used by Signal:

- **🔑 Curve25519** - Elliptic curve Diffie-Hellman for key exchange
- **🔒 XSalsa20-Poly1305** - Authenticated encryption with additional data
- **🎲 Perfect Forward Secrecy** - Each message uses unique ephemeral keys
- **📱 Device-only keys** - Private keys never leave your device
- **🚫 Zero-knowledge** - Server never sees unencrypted content

## Features

- 🎤 **One-tap voice recording** - Hold to record, release to send
- 👻 **Auto-vanishing messages** - Messages disappear forever after playback
- 🔐 **End-to-end encryption** - Military-grade NaCl encryption
- 🎭 **Anonymous accounts** - No email, phone, or personal data required
- 🔑 **Secure key storage** - iOS Keychain / Android Keystore
- 📍 **Privacy-first design** - Minimal metadata, maximum privacy
- 🎯 **Friend codes** - Connect without sharing personal info

## Security Architecture

### End-to-End Encryption Flow
```
Sender Device                    Server                    Recipient Device
-------------                    ------                    ----------------
1. Record audio
2. Generate ephemeral keys
3. Encrypt with NaCl      →     Stores encrypted blob    →    4. Download blob
                                (never sees content)           5. Decrypt with NaCl
                                                              6. Play & auto-delete
```

### What Makes It Secure
- **No access to content**: Server only stores encrypted blobs
- **No key escrow**: Private keys are generated on-device and never uploaded
- **Forward secrecy**: Compromising one message doesn't affect others
- **Authenticated encryption**: Messages can't be tampered with
- **Ephemeral by design**: Messages auto-delete after playback

## Tech Stack

- **Frontend**: React Native with Expo (TypeScript)
- **Backend**: Supabase (PostgreSQL, Storage, Auth)
- **Encryption**: TweetNaCl (NaCl in JavaScript)
- **Key Storage**: react-native-keychain (iOS Keychain / Android Keystore)
- **Audio**: expo-av for recording/playback
- **State**: React Context + Zustand

## Getting Started

### Prerequisites

- Node.js 18+ (automatic version switching configured - see [Node Version Isolation](./docs/setup/NODE_VERSION_ISOLATION.md))
- Expo CLI
- iOS Simulator (Mac) or Android Emulator
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/VanishVoice.git
cd VanishVoice
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Add your Supabase credentials to `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Start the development server:
```bash
npx expo start
```

### Supabase Setup

1. Create a new Supabase project
2. Run the schema in `supabase/schema.sql`
3. Create a storage bucket named `voice-messages`
4. Deploy Edge Functions:
```bash
supabase functions deploy expire-messages
supabase functions deploy cleanup-storage
```

## Project Structure

```
VanishVoice/
├── src/
│   ├── components/      # Reusable components
│   ├── contexts/        # React contexts
│   ├── screens/         # App screens
│   ├── services/        # External services
│   ├── types/          # TypeScript types
│   └── utils/          # Utilities
├── supabase/
│   ├── functions/      # Edge Functions
│   ├── migrations/     # Database migrations
│   └── schema.sql      # Initial schema
├── docs/               # Documentation
└── App.tsx            # Entry point
```

## Development

- Run iOS: `npx expo run:ios`
- Run Android: `npx expo run:android`
- Run tests: `npm test` (when implemented)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Documentation

For detailed documentation, see the [`/docs`](./docs) directory:
- [Security Implementation](./docs/security/NACL_IMPLEMENTATION_GUIDE.md)
- [Setup Guide](./docs/setup/SETUP.md)
- [Node Version Isolation](./docs/setup/NODE_VERSION_ISOLATION.md)
- [Development Guide](./docs/development/PROJECT_STATUS.md)
- [Troubleshooting](./docs/troubleshooting/)

## Future Features

- 💾 **Mutual save requests** - Both parties consent to save a message
- 📍 **Location-based expiry** - Messages vanish when you leave an area
- 🎉 **Event-triggered expiry** - Messages tied to calendar events
- 👥 **Group messages** - Encrypted group voice notes
- 🌍 **Multi-language support** - Localized interface
- 🔍 **Voice transcription** - Optional encrypted transcripts

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

Built with ❤️ using Expo and Supabase