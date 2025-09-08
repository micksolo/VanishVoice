# VanishVoice Database Setup

Your Supabase project needs these database tables to work properly. Run these SQL commands in the Supabase SQL Editor.

## Required Tables

### 1. Users Table
```sql
CREATE TABLE public.users (
    id UUID REFERENCES auth.users ON DELETE CASCADE,
    anon_id TEXT UNIQUE NOT NULL,
    friend_code TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own data
CREATE POLICY "Users can insert own data" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);
```

### 2. Messages Table (Optional - for future features)
```sql
CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'voice', 'video')),
    encrypted_content TEXT,
    encryption_method TEXT DEFAULT 'nacl_box',
    expiry_rule JSONB,
    has_been_viewed BOOLEAN DEFAULT FALSE,
    is_expired BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'viewed', 'read', 'disappeared')),
    sender_cleared BOOLEAN DEFAULT FALSE,
    recipient_cleared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    listened_at TIMESTAMP WITH TIME ZONE,
    cleared_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can only see messages they sent or received
CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (
        auth.uid() = sender_id OR 
        auth.uid() = recipient_id
    );

-- Users can insert messages they send
CREATE POLICY "Users can insert own messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update messages they're involved in
CREATE POLICY "Users can update own messages" ON public.messages
    FOR UPDATE USING (
        auth.uid() = sender_id OR 
        auth.uid() = recipient_id
    );
```

### 3. Chat Sessions Table (Optional)
```sql
CREATE TABLE public.chat_sessions (
    id TEXT PRIMARY KEY,
    participants UUID[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    message_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see sessions they're part of
CREATE POLICY "Users can view own sessions" ON public.chat_sessions
    FOR SELECT USING (auth.uid() = ANY(participants));

-- Users can insert sessions they're part of
CREATE POLICY "Users can insert own sessions" ON public.chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = ANY(participants));

-- Users can update sessions they're part of
CREATE POLICY "Users can update own sessions" ON public.chat_sessions
    FOR UPDATE USING (auth.uid() = ANY(participants));
```

## Setup Steps

1. **Go to your Supabase project dashboard**
   - URL: https://supabase.com/dashboard/project/dhzblvgfexkgkxhhdlpk

2. **Open the SQL Editor**
   - Click "SQL Editor" in the left sidebar

3. **Create the tables**
   - Copy and paste the SQL above
   - Click "Run" to execute

4. **Verify the setup**
   - Go to "Table Editor" to see your tables
   - Restart the React Native app

## Authentication Settings

Make sure these are enabled in **Authentication > Settings**:
- ✅ Enable email confirmations: **OFF** (for anonymous users)
- ✅ Enable signup: **ON**
- ✅ Enable manual linking of users: **ON**

## Storage (for voice/video files)

Create a storage bucket named `voice-messages`:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-messages', 'voice-messages', false);

-- Allow authenticated users to upload/download their own files
CREATE POLICY "Users can upload own files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files" ON storage.objects
    FOR SELECT USING (bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files" ON storage.objects
    FOR DELETE USING (bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## Troubleshooting

If you still see network errors:
1. Check that your Supabase project is not paused
2. Verify the API keys in `.env` are correct
3. Make sure RLS policies are set up correctly
4. Check the Supabase logs for any errors