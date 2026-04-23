// Edge Function to create users via Admin API without auto-login
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, prefer',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )
  }

  try {
    // Create a Supabase admin client with the service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header')
    }

    const token = authHeader.replace('Bearer ', '').trim()

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Get the user's profile to check if they're an admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single()

    if (
      profileError ||
      !profile ||
      (profile.user_type !== 'admin' && profile.user_type !== 'super-admin')
    ) {
      throw new Error('Only admins can create users')
    }

    // Get the request body
    const { email, password, user_metadata } = await req.json()

    if (!email || !password) {
      throw new Error('Email and password are required')
    }

    if (!user_metadata?.first_name || !user_metadata?.last_name || !user_metadata?.user_type) {
      throw new Error('Missing required user metadata')
    }

    // Create the user using Admin API (no auto-login)
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: user_metadata || {},
      })

    if (createError) {
      throw new Error(createError.message)
    }

    if (!newUser.user) {
      throw new Error('Failed to create user')
    }

    // Create profile
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id: newUser.user.id,
          email: email,
          first_name: user_metadata.first_name ?? null,
          middle_name: user_metadata.middle_name ?? null,
          last_name: user_metadata.last_name ?? null,
          user_type: user_metadata.user_type ?? null,
          farm_name: user_metadata.farm_name ?? null,
          farm_size: user_metadata.farm_size ?? null,
          phone: user_metadata.phone ?? null,
          barangay: user_metadata.barangay ?? null,
          full_address: user_metadata.full_address ?? user_metadata.address ?? null,
        },
      ])

    if (profileInsertError) {
      // cleanup auth user if profile insert fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      throw new Error(`Failed to create profile: ${profileInsertError.message}`)
    }

    // Create verification submission
    const { error: verificationError } = await supabaseAdmin
      .from('verification_submissions')
      .insert([
        {
          user_id: newUser.user.id,
          id_document_url: '',
          face_photo_url: '',
          id_document_type: 'admin_created',
          status: 'approved',
          submitted_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          admin_notes:
            'User created directly by administrator - no verification documents required',
        },
      ])

    if (verificationError) {
      console.error('Failed to create verification:', verificationError)
      // Don't fail the whole operation
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        message: 'User created successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
