import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all expired messages
    const { data: expiredMessages, error: fetchError } = await supabase
      .from('messages')
      .select('media_path')
      .eq('expired', true);

    if (fetchError) throw fetchError;

    let deletedCount = 0;

    // Delete associated audio files from storage
    if (expiredMessages && expiredMessages.length > 0) {
      const filePaths = expiredMessages
        .map(m => m.media_path)
        .filter(path => path !== 'placeholder');

      if (filePaths.length > 0) {
        const { data, error: deleteError } = await supabase.storage
          .from('voice-messages')
          .remove(filePaths);

        if (!deleteError) {
          deletedCount = filePaths.length;
        }
      }
    }

    // Clean up orphaned files (files without corresponding messages)
    const { data: allFiles, error: listError } = await supabase.storage
      .from('voice-messages')
      .list('', { limit: 1000 });

    if (allFiles && !listError) {
      const { data: activeMessages } = await supabase
        .from('messages')
        .select('media_path')
        .eq('expired', false);

      const activePaths = new Set(activeMessages?.map(m => m.media_path) || []);
      
      const orphanedFiles = allFiles
        .filter(file => !activePaths.has(file.name))
        .map(file => file.name);

      if (orphanedFiles.length > 0) {
        await supabase.storage
          .from('voice-messages')
          .remove(orphanedFiles);
        deletedCount += orphanedFiles.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedFiles: deletedCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});