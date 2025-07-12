import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sessionId, preferences = {} } = await req.json();
    console.log('[match-users] Processing match request for session:', sessionId);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if already in a conversation
    const { data: existingConv } = await supabase
      .from('anonymous_conversations')
      .select('*')
      .or(`session_a.eq.${sessionId},session_b.eq.${sessionId}`)
      .is('ended_at', null)
      .single();

    if (existingConv) {
      console.log('[match-users] Session already in conversation:', existingConv.id);
      const partnerId = existingConv.session_a === sessionId 
        ? existingConv.session_b 
        : existingConv.session_a;
      
      return new Response(JSON.stringify({
        matched: true,
        conversationId: existingConv.id,
        partnerId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Add to waiting pool
    const { error: poolError } = await supabase
      .from('waiting_pool')
      .upsert({
        session_id: sessionId,
        preferences,
        joined_at: new Date().toISOString()
      });

    if (poolError) {
      console.error('[match-users] Error adding to pool:', poolError);
    }

    // Find a match in the waiting pool
    let query = supabase
      .from('waiting_pool')
      .select('*, session:anonymous_sessions!session_id(*)')
      .neq('session_id', sessionId)
      .order('joined_at', { ascending: true })
      .limit(1);

    // Apply preference filters if provided
    if (preferences.gender && preferences.gender !== 'any') {
      // This would require additional user profile data
      console.log('[match-users] Gender preference filtering not yet implemented');
    }

    const { data: matches, error: matchError } = await query;

    if (matchError) {
      console.error('[match-users] Error finding match:', matchError);
      throw matchError;
    }

    if (matches && matches.length > 0) {
      const match = matches[0];
      console.log('[match-users] Found match:', match.session_id);

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('anonymous_conversations')
        .insert({
          session_a: sessionId,
          session_b: match.session_id,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (convError) {
        console.error('[match-users] Error creating conversation:', convError);
        throw convError;
      }

      // Remove both users from waiting pool
      await supabase
        .from('waiting_pool')
        .delete()
        .in('session_id', [sessionId, match.session_id]);

      console.log('[match-users] Created conversation:', conversation.id);

      return new Response(JSON.stringify({
        matched: true,
        conversationId: conversation.id,
        partnerId: match.session_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // No match found, user is in waiting pool
    console.log('[match-users] No match found, user added to waiting pool');
    return new Response(JSON.stringify({
      matched: false,
      message: 'Added to waiting pool'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[match-users] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});