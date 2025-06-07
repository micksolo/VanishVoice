import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface PushMessage {
  to: string
  sound: 'default' | null
  title: string
  body: string
  data?: Record<string, any>
  badge?: number
  categoryId?: string
}

Deno.serve(async (req: Request) => {
  try {
    // Verify the request is authorized
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { recipientId, senderId, senderName, messageId } = await req.json()

    // Get recipient's push tokens from database
    const { data: pushTokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', recipientId)

    if (tokenError) {
      throw new Error(`Failed to fetch push tokens: ${tokenError.message}`)
    }

    if (!pushTokens || pushTokens.length === 0) {
      console.log('No push tokens found for recipient')
      return new Response(JSON.stringify({ success: true, message: 'No tokens' }), {
        headers: { 
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        },
      })
    }

    // Prepare push messages
    const messages: PushMessage[] = pushTokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title: 'New Voice Message',
      body: `${senderName || 'Someone'} sent you a voice message`,
      data: {
        type: 'new_message',
        messageId,
        senderId,
      },
      badge: 1,
    }))

    // Send to Expo Push Notification service
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    const result = await response.json()
    console.log('Push notification result:', result)

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
    })
  } catch (error) {
    console.error('Error sending push notification:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
    })
  }
})