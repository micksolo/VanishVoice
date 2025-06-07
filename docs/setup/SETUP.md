# VanishVoice Setup Instructions

## 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API
3. Go to SQL Editor and run the contents of `supabase/schema.sql`

## 2. Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

## 3. Enable Anonymous Authentication

1. In Supabase Dashboard, go to Authentication > Providers
2. Enable "Anonymous Sign-Ins"

## 4. Run the App

```bash
# Install dependencies
npm install

# Start the development server
npx expo start

# Press 'i' for iOS simulator or 'a' for Android emulator
```

## Project Structure

- `/src/components` - Reusable UI components
- `/src/screens` - App screens (Home, Chat, etc.)
- `/src/services` - External services (Supabase, encryption)
- `/src/store` - Zustand state management
- `/src/types` - TypeScript type definitions
- `/src/utils` - Helper functions
- `/src/constants` - App constants