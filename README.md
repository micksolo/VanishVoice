# VanishVoice 👻🎙️

An ephemeral voice messaging app where messages vanish after being heard. Built with React Native (Expo) and Supabase.

## Features

- 🎤 **One-tap voice recording** - Hold to record, release to send
- 👻 **Auto-vanishing messages** - Messages disappear after playback
- 🔐 **Anonymous user system** - No email/phone required
- 🎲 **Random Connect** - Connect with random users anonymously
- 📍 **Privacy-first design** - Message count only, sender hidden until tap
- 🔄 **Real-time updates** - New message notifications
- 🎯 **Friend codes** - Share your code to connect

## Tech Stack

- **Frontend**: React Native with Expo (TypeScript)
- **Backend**: Supabase (PostgreSQL, Storage, Auth)
- **Audio**: expo-av for recording/playback
- **Storage**: Supabase Storage for voice files
- **State**: React Context + Zustand

## Getting Started

### Prerequisites

- Node.js 18+
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

## Future Features

- 💾 Mutual save requests
- 📍 Location-based messages
- 🎉 Event-triggered messages
- 🔐 End-to-end encryption
- 🌍 Multi-language support

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

Built with ❤️ using Expo and Supabase