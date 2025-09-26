import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('📱 Processing FCM notification queue...')

    // Get pending notifications from queue (limit to 50 to stay within function limits)
    const { data: queueItems, error: queueError } = await supabase
      .from('fcm_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3) // Max 3 attempts
      .order('created_at', { ascending: true })
      .limit(50)

    if (queueError) {
      console.error('❌ Error fetching queue items:', queueError)
      throw queueError
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('✅ No pending notifications in queue')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending notifications in queue',
          processed: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`📤 Processing ${queueItems.length} notifications...`)

    let successCount = 0
    let failureCount = 0

    // Process each notification
    for (const item of queueItems) {
      try {
        // Get FCM tokens for the recipient
        const { data: tokens, error: tokensError } = await supabase
          .from('fcm_tokens')
          .select('token, platform')
          .eq('user_id', item.recipient_id)

        if (tokensError) {
          console.error('❌ Error fetching FCM tokens for user:', item.recipient_id, tokensError)
          await markQueueItemFailed(supabase, item.id, `Token fetch error: ${tokensError.message}`)
          failureCount++
          continue
        }

        if (!tokens || tokens.length === 0) {
          console.log('⚠️ No FCM tokens found for user:', item.recipient_id)
          await markQueueItemFailed(supabase, item.id, 'No FCM tokens found')
          failureCount++
          continue
        }

        // Send FCM notification to each token
        let tokenSuccessCount = 0
        for (const tokenData of tokens) {
          try {
            const fcmPayload = {
              to: tokenData.token,
              notification: {
                title: item.title,
                body: item.body,
              },
              data: {
                // Convert all data values to strings (FCM requirement)
                ...Object.fromEntries(
                  Object.entries(item.data || {}).map(([key, value]) => [
                    key,
                    typeof value === 'string' ? value : JSON.stringify(value)
                  ])
                ),
              },
              priority: 'high',
              time_to_live: 86400, // 24 hours
            }

            const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
              method: 'POST',
              headers: {
                'Authorization': `key=${fcmServerKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(fcmPayload),
            })

            const fcmResult = await fcmResponse.json()

            if (fcmResponse.ok && fcmResult.success >= 1) {
              console.log('✅ FCM sent successfully to token:', tokenData.platform)
              tokenSuccessCount++
            } else {
              console.error('❌ FCM failed for token:', fcmResult)

              // If token is invalid, remove it from database
              if (fcmResult.failure === 1 && fcmResult.results?.[0]?.error === 'InvalidRegistration') {
                console.log('🗑️ Removing invalid FCM token')
                await supabase
                  .from('fcm_tokens')
                  .delete()
                  .eq('token', tokenData.token)
              }
            }
          } catch (tokenError) {
            console.error('❌ Exception sending to token:', tokenError)
          }
        }

        // Update queue item status
        if (tokenSuccessCount > 0) {
          await markQueueItemSent(supabase, item.id)
          successCount++
        } else {
          await markQueueItemFailed(supabase, item.id, 'All tokens failed')
          failureCount++
        }

      } catch (itemError) {
        console.error('❌ Error processing queue item:', item.id, itemError)
        await markQueueItemFailed(supabase, item.id, `Processing error: ${itemError.message}`)
        failureCount++
      }
    }

    console.log(`✅ Queue processing complete. Success: ${successCount}, Failed: ${failureCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${queueItems.length} notifications`,
        processed: queueItems.length,
        successCount,
        failureCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ FCM queue processor error:', error)

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

// Helper function to mark queue item as sent
async function markQueueItemSent(supabase: any, itemId: string) {
  const { error } = await supabase
    .from('fcm_notification_queue')
    .update({
      status: 'sent',
      processed_at: new Date().toISOString()
    })
    .eq('id', itemId)

  if (error) {
    console.error('❌ Error marking queue item as sent:', error)
  }
}

// Helper function to mark queue item as failed
async function markQueueItemFailed(supabase: any, itemId: string, errorMessage: string) {
  const { error } = await supabase
    .from('fcm_notification_queue')
    .update({
      status: 'failed',
      attempts: supabase.raw('attempts + 1'),
      processed_at: new Date().toISOString(),
      data: supabase.raw(`COALESCE(data, '{}'::jsonb) || '{"error": "${errorMessage}"}'::jsonb`)
    })
    .eq('id', itemId)

  if (error) {
    console.error('❌ Error marking queue item as failed:', error)
  }
}