-- Create videos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos', 
  'videos', 
  false, -- private bucket
  104857600, -- 100MB file size limit
  ARRAY['video/mp4', 'video/quicktime', 'video/x-m4v', 'application/octet-stream', 'application/json']::text[]
)
ON CONFLICT (id) DO UPDATE
SET 
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create RLS policies for videos bucket

-- Allow authenticated users to upload videos
CREATE POLICY "Users can upload videos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'videos');

-- Allow authenticated users to read videos
CREATE POLICY "Users can read videos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'videos');

-- Allow authenticated users to delete their own videos
CREATE POLICY "Users can delete videos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'videos');

-- Allow authenticated users to update their own videos
CREATE POLICY "Users can update videos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');