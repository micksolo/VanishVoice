import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // 1. Expire time-based messages
    const { data: timeExpired, error: timeError } = await supabase
      .from('messages')
      .update({ expired: true })
      .eq('expired', false)
      .not('listened_at', 'is', null)
      .lte('listened_at', new Date(Date.now() - 60000).toISOString()); // 1 minute after listening

    // 2. Expire messages based on expiry rules
    const { data: ruleBasedMessages, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('expired', false);

    if (ruleBasedMessages) {
      for (const message of ruleBasedMessages) {
        let shouldExpire = false;

        // Check time-based expiry
        if (message.expiry_rule.type === 'time') {
          const expiryTime = new Date(message.created_at).getTime() + 
            (message.expiry_rule.duration_sec * 1000);
          shouldExpire = Date.now() > expiryTime;
        }

        // Check playback-based expiry (already handled by app)
        if (message.expiry_rule.type === 'playback' && message.listened_at) {
          shouldExpire = true;
        }

        if (shouldExpire) {
          await supabase
            .from('messages')
            .update({ expired: true })
            .eq('id', message.id);
        }
      }
    }

    // 3. Delete expired messages older than 24 hours
    const { data: deleted, error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('expired', true)
      .lt('created_at', new Date(Date.now() - 86400000).toISOString());

    return new Response(
      JSON.stringify({
        timeExpired: timeExpired?.length || 0,
        deleted: deleted?.length || 0,
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