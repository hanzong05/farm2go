// Supabase Edge Function for Visual Search
// This proxies requests to Clarifai API to avoid CORS issues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClarifaiConcept {
  name: string;
  value: number;
}

interface ClarifaiResponse {
  outputs?: Array<{
    data?: {
      concepts?: ClarifaiConcept[];
    };
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Clarifai API key from environment
    const CLARIFAI_API_KEY = Deno.env.get('CLARIFAI_API_KEY')
    const CLARIFAI_MODEL_ID = Deno.env.get('CLARIFAI_MODEL_ID') || 'food-item-recognition'

    if (!CLARIFAI_API_KEY) {
      throw new Error('CLARIFAI_API_KEY not configured')
    }

    // Parse request body
    const { imageBase64 } = await req.json()

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Remove data URI prefix if present
    const base64Image = imageBase64.replace(/^data:image\/\w+;base64,/, '')

    console.log('Analyzing image with Clarifai API...')

    // Call Clarifai API
    const requestBody = {
      user_app_id: {
        user_id: 'clarifai',
        app_id: 'main',
      },
      inputs: [
        {
          data: {
            image: {
              base64: base64Image,
            },
          },
        },
      ],
    }

    const response = await fetch(
      `https://api.clarifai.com/v2/models/${CLARIFAI_MODEL_ID}/outputs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${CLARIFAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Clarifai API error:', errorText)
      throw new Error(`Clarifai API error: ${response.status}`)
    }

    const data: ClarifaiResponse = await response.json()

    // Extract concepts
    const concepts = data.outputs?.[0]?.data?.concepts || []

    console.log(`Found ${concepts.length} concepts`)

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in visual-search function:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
