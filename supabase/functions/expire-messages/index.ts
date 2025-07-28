import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeletedMessage {
  id: string;
  media_path?: string;
  message_type: 'text' | 'voice' | 'video';
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get messages that will be deleted (for media cleanup)
    const { data: messagesToDelete } = await supabase
      .from('messages')
      .select('id, media_path, message_type')
      .eq('expired', true)
      .or(`viewed_at.lt.${new Date(Date.now() - 86400000).toISOString()},listened_at.lt.${new Date(Date.now() - 86400000).toISOString()},read_at.lt.${new Date(Date.now() - 86400000).toISOString()},created_at.lt.${new Date(Date.now() - 172800000).toISOString()}`);

    // Clean up media files from storage
    const mediaDeleted: string[] = [];
    if (messagesToDelete && messagesToDelete.length > 0) {
      for (const msg of messagesToDelete as DeletedMessage[]) {
        if (msg.media_path) {
          try {
            // Determine the bucket based on message type
            const bucket = msg.message_type === 'video' ? 'videos' : 'audio';
            
            // Extract the file path from the media_path
            // media_path format: "audio/user_id/filename" or "videos/user_id/filename"
            const pathParts = msg.media_path.split('/');
            if (pathParts.length >= 2) {
              const filePath = pathParts.slice(1).join('/'); // Remove bucket name
              
              const { error } = await supabase.storage
                .from(bucket)
                .remove([filePath]);
              
              if (!error) {
                mediaDeleted.push(msg.media_path);
              } else {
                console.error(`Failed to delete ${msg.media_path}:`, error);
              }
            }
          } catch (err) {
            console.error(`Error deleting media ${msg.media_path}:`, err);
          }
        }
      }
    }

    // Call the database function to handle message expiry and deletion
    const { data: result, error: deleteError } = await supabase
      .rpc('delete_expired_messages');

    if (deleteError) {
      throw deleteError;
    }

    // Also check for messages that need to be expired based on the is_expired computed column
    const { data: newlyExpired, error: expireError } = await supabase
      .from('messages')
      .update({ expired: true })
      .eq('expired', false)
      .eq('is_expired', true)
      .select();

    // Log the operation results
    console.log('Expiry job completed:', {
      deleted_count: result?.deleted_count || 0,
      log_entries: result?.log_entries || 0,
      newly_expired: newlyExpired?.length || 0,
      media_deleted: mediaDeleted.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: result?.deleted_count || 0,
        log_entries: result?.log_entries || 0,
        newly_expired: newlyExpired?.length || 0,
        media_deleted: mediaDeleted.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Expiry job error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});