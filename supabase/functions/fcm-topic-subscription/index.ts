import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TopicSubscriptionRequest {
  action: 'subscribe' | 'unsubscribe';
  topic: string;
  token: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get FCM server key from environment
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY')
    if (!fcmServerKey) {
      throw new Error('FCM_SERVER_KEY environment variable is required')
    }

    // Parse request body
    const { action, topic, token }: TopicSubscriptionRequest = await req.json()

    console.log('📢 FCM topic subscription request:', { action, topic, tokenExists: !!token })

    // Validate request
    if (!action || !topic || !token) {
      throw new Error('Action, topic, and token are required')
    }

    if (!['subscribe', 'unsubscribe'].includes(action)) {
      throw new Error('Action must be either "subscribe" or "unsubscribe"')
    }

    // Determine FCM endpoint
    const endpoint = action === 'subscribe'
      ? `https://iid.googleapis.com/iid/v1/${token}/rel/topics/${topic}`
      : `https://iid.googleapis.com/iid/v1/${token}/rel/topics/${topic}`

    const method = action === 'subscribe' ? 'POST' : 'DELETE'

    console.log(`📤 ${action === 'subscribe' ? 'Subscribing to' : 'Unsubscribing from'} topic: ${topic}`)

    // Make request to FCM
    const fcmResponse = await fetch(endpoint, {
      method,
      headers: {
        'Authorization': `key=${fcmServerKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (fcmResponse.ok) {
      console.log(`✅ Successfully ${action}d ${action === 'subscribe' ? 'to' : 'from'} topic: ${topic}`)

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully ${action}d ${action === 'subscribe' ? 'to' : 'from'} topic: ${topic}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      const errorText = await fcmResponse.text()
      console.error(`❌ Failed to ${action} topic:`, errorText)

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to ${action} topic: ${errorText}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: fcmResponse.status
        }
      )
    }

  } catch (error) {
    console.error('❌ FCM topic subscription error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})