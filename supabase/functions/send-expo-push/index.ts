import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushRequest {
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { userId, userIds, title, body, data = {} }: PushRequest = await req.json()

    console.log('📱 Expo push notification request:', { userId, userIds, title })

    // Validate request
    if (!title || !body) {
      throw new Error('Title and body are required')
    }

    if (!userId && !userIds) {
      throw new Error('Either userId or userIds must be provided')
    }

    // Get push tokens for users
    const targetUserIds = userId ? [userId] : userIds!

    console.log('👥 Getting push tokens for users:', targetUserIds)

    const { data: tokens, error: tokensError } = await supabase
      .from('expo_push_tokens')
      .select('token, platform, user_id')
      .in('user_id', targetUserIds)

    if (tokensError) {
      console.error('❌ Error fetching push tokens:', tokensError)
      throw tokensError
    }

    console.log('🎯 Found push tokens:', tokens?.length || 0)

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No push tokens found for specified users'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }

    // Prepare push messages
    const messages = tokens.map(tokenData => ({
      to: tokenData.token,
      sound: 'default',
      title,
      body,
      data: {
        userId: tokenData.user_id,
        ...data
      },
    }))

    console.log('📤 Sending push notifications to', messages.length, 'tokens')

    // Send via Expo Push API
    const expoPushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    const expoPushResult = await expoPushResponse.json()

    if (expoPushResponse.ok) {
      console.log('✅ Push notifications sent successfully:', expoPushResult)

      // Count successful sends
      const successCount = expoPushResult.data
        ? expoPushResult.data.filter((result: any) => result.status === 'ok').length
        : messages.length

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sent ${successCount}/${messages.length} notifications successfully`,
          results: expoPushResult
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      console.error('❌ Expo push API error:', expoPushResult)

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send push notifications',
          details: expoPushResult
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: expoPushResponse.status
        }
      )
    }

  } catch (error) {
    console.error('❌ Expo push function error:', error)

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