import { Linking, Platform } from 'react-native';
import { supabase, signInWithGoogleOAuth } from '../lib/supabase';
import { Database } from '../types/database';
import type { AuthResponse } from '@supabase/supabase-js';

// Check if we're in demo mode
const isDemoMode = !process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL === 'https://demo.supabase.co';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface RegisterData {
  email: string;
  phone: string;
  password: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  barangay: string;
  userType: 'farmer' | 'buyer';
  // Farmer specific
  farmName?: string;
  farmSize?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// Register new user
export const registerUser = async (data: RegisterData) => {
  try {
    console.log('🚀 Starting user registration process...');
    console.log('📧 Email:', data.email);
    console.log('👤 User type:', data.userType);
    console.log('📍 Barangay:', data.barangay);

    // If in demo mode, simulate successful registration
    if (isDemoMode) {
      console.log('🚀 Demo mode: Simulating user registration');

      // Return mock user data
      const mockUser = {
        id: `demo-${Date.now()}`,
        email: data.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockProfile = {
        id: mockUser.id,
        email: data.email,
        phone: data.phone,
        first_name: data.firstName,
        middle_name: data.middleName || null,
        last_name: data.lastName,
        barangay: data.barangay,
        user_type: data.userType as 'farmer' | 'buyer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        farm_name: data.farmName || null,
        farm_size: data.farmSize || null,
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { user: mockUser, profile: mockProfile };
    }

    console.log('📡 Creating Supabase auth user...');

    // Create auth user using email with timeout
    const signupPromise = supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Registration timeout after 30 seconds. Please check your internet connection and try again.'));
      }, 30000);
    });

    const authResult = await Promise.race([
      signupPromise,
      timeoutPromise
    ]) as AuthResponse;

    const { data: authData, error: authError } = authResult;

    console.log('📡 Auth signup response:', {
      user: authData?.user ? 'User created' : 'No user',
      session: authData?.session ? 'Session created' : 'No session',
      error: authError ? authError.message : 'No error',
      userConfirmed: authData?.user?.email_confirmed_at ? 'Email confirmed' : 'Email not confirmed'
    });

    if (authError) {
      console.error('❌ Auth signup error:', authError);
      throw authError;
    }

    if (!authData.user) {
      console.error('❌ No user returned from signup');
      throw new Error('Failed to create user');
    }

    if (!authData.user.id) {
      console.error('❌ No user ID returned from signup');
      throw new Error('Failed to create user - no ID');
    }

    console.log('✅ Auth user created successfully:', authData.user.id);

    console.log('📝 Creating user profile...');

    // Create user profile
    const profileData: Database['public']['Tables']['profiles']['Insert'] = {
      id: authData.user.id,
      email: data.email,
      phone: data.phone,
      first_name: data.firstName,
      middle_name: data.middleName || null,
      last_name: data.lastName,
      barangay: data.barangay,
      user_type: data.userType as 'farmer' | 'buyer',
      // Farmer fields
      farm_name: data.farmName || null,
      farm_size: data.farmSize || null,
    };

    console.log('📝 Profile data:', {
      id: profileData.id,
      user_type: profileData.user_type,
      first_name: profileData.first_name,
      last_name: profileData.last_name,
      barangay: profileData.barangay
    });

    try {
      console.log('📡 Inserting profile into database...');
      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData as any);

      if (profileError) {
        console.error('❌ Profile creation error:', profileError);
        throw profileError;
      }

      console.log('✅ Profile created successfully');
    } catch (profileError: any) {
      // Handle various database errors gracefully
      if (
        // RLS policy errors
        profileError?.code === '42501' ||
        profileError?.message?.includes('row-level security') ||
        profileError?.message?.includes('401') ||
        profileError?.message?.includes('Unauthorized') ||
        profileError?.status === 401
      ) {
        console.warn('⚠️ RLS policy or authorization blocked profile creation. User registered but profile creation failed.');
        console.warn('📝 To fix this, run the RLS policy SQL commands in your Supabase database.');
        return { user: authData.user, profile: null };
      } else if (
        // Duplicate key errors (user already exists)
        profileError?.code === '23505' ||
        profileError?.message?.includes('duplicate key') ||
        profileError?.message?.includes('already exists')
      ) {
        console.warn('⚠️ Profile already exists for this user. This can happen if the user was created previously.');
        // Try to fetch the existing profile instead
        try {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          return { user: authData.user, profile: existingProfile };
        } catch {
          return { user: authData.user, profile: null };
        }
      }

      throw profileError;
    }

    console.log('🎉 Registration completed successfully!');
    return { user: authData.user, profile: profileData };
  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('❌ Full error details:', JSON.stringify(error, null, 2));
    throw error;
  }
};

// Login user
export const loginUser = async (data: LoginData) => {
  try {
    // If in demo mode, simulate successful login
    if (isDemoMode) {
      console.log('🚀 Demo mode: Simulating user login');

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // Return mock session data
      const mockUser = {
        id: 'demo-user-123',
        email: data.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return {
        user: mockUser,
        session: {
          access_token: 'demo-token',
          refresh_token: 'demo-refresh',
          expires_in: 3600,
          expires_at: Date.now() + 3600000,
          user: mockUser,
        }
      };
    }

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      throw error;
    }

    return authData;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Logout user
export const logoutUser = async () => {
  try {
    console.log('🔄 Auth service: Starting logout...');

    // Use session manager for logout to ensure proper cleanup
    const { sessionManager } = await import('./sessionManager');
    await sessionManager.clearSession();

    console.log('✅ Auth service: Logout completed successfully');
  } catch (error) {
    console.error('❌ Auth service: Logout error:', error);

    // Fallback to direct Supabase logout
    try {
      console.log('🔄 Auth service: Attempting fallback logout...');
      await supabase.auth.signOut();
      console.log('✅ Auth service: Fallback logout successful');
    } catch (fallbackError) {
      console.error('❌ Auth service: Fallback logout error:', fallbackError);
    }
    throw error;
  }
};

// Reset password
export const resetPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'farm2go://reset-password',
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};

// Get current session
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    return session;
  } catch (error) {
    console.error('Get session error:', error);
    throw error;
  }
};

// Helper function to check for existing user profile by email
export const checkExistingUserProfile = async (email: string): Promise<Profile | null> => {
  try {
    console.log('🔍 Checking for existing profile with email:', email);

    const { data: existingProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking existing profile:', error);
      return null;
    }

    if (existingProfile) {
      const profile = existingProfile as Profile;
      console.log('✅ Found existing profile:', {
        id: profile.id,
        user_type: profile.user_type,
        email: profile.email
      });
      return profile;
    }

    console.log('ℹ️ No existing profile found for email:', email);
    return null;
  } catch (error) {
    console.error('❌ Error checking existing profile:', error);
    return null;
  }
};

// Helper function to check if user exists by email (lightweight check for registration)
export const checkUserExistsByEmail = async (email: string): Promise<boolean> => {
  try {
    console.log('🔍 Checking if user exists with email:', email);

    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking user existence:', error);
      return false;
    }

    const exists = !!data;
    console.log(`${exists ? '✅' : 'ℹ️'} User ${exists ? 'exists' : 'does not exist'} with email:`, email);
    return exists;
  } catch (error) {
    console.error('❌ Error checking user existence:', error);
    return false;
  }
};

// Social auth functions
export const signInWithGoogle = async (isRegistration = false) => {
  try {
    console.log('🔥 signInWithGoogle auth service called!');
    console.log('🚀 Starting in-app Google OAuth sign in...');
    console.log('📝 Registration mode:', isRegistration);

    if (isDemoMode) {
      console.log('🚀 Demo mode: Simulating Google OAuth');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockUser = {
        id: `google-demo-${Date.now()}`,
        email: 'demo@google.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return { user: mockUser, session: null };
    }

    // Get userType from session manager for registration
    let userType = 'buyer'; // Default for sign-in
    if (isRegistration) {
      try {
        const { sessionManager } = await import('./sessionManager');
        const oauthState = await sessionManager.getOAuthState();
        userType = oauthState?.userType || 'buyer';
        console.log('📝 Retrieved userType from session:', userType);
      } catch (error) {
        console.log('⚠️ Could not get userType from session, using default:', userType);
      }
    }

    const intent = isRegistration ? 'registration' : 'signin';

    const result = await signInWithGoogleOAuth(userType, intent);

    // Handle post-OAuth processing
    if (result && result.sessionData) {
      console.log('✅ OAuth session established');

      // Check if user already has a profile
      const user = result.sessionData.user;
      if (user) {
        console.log('🔍 Checking for existing profile...');
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (existingProfile) {
          console.log('✅ Existing profile found, user is authenticated');
          return { user, profile: existingProfile, needsRedirect: true };
        } else {
          console.log('ℹ️ No profile found, needs profile completion');
          return { user, profile: null, needsProfileCompletion: true };
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  }
};

export const signInWithFacebook = async () => {
  try {
    console.log('🚀 Starting Facebook OAuth sign in...');

    if (isDemoMode) {
      console.log('🚀 Demo mode: Simulating Facebook OAuth');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockUser = {
        id: `facebook-demo-${Date.now()}`,
        email: 'demo@facebook.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return { user: mockUser, session: null };
    }

    const facebookRedirectTo = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'http://localhost:8081/auth/callback')
      : 'farm2go://auth/callback';
    console.log('🔗 Facebook Redirect URL:', facebookRedirectTo);
    console.log('📱 Platform:', Platform.OS);

    const facebookOauthOptions = {
      provider: 'facebook' as const,
      options: {
        redirectTo: facebookRedirectTo,
        scopes: 'email',
      },
    };

    // For mobile platforms, try to open OAuth in external browser
    if (Platform.OS !== 'web') {
      console.log('📱 Mobile platform detected, attempting external browser OAuth...');
    }

    const { data, error } = await supabase.auth.signInWithOAuth(facebookOauthOptions);

    if (error) {
      console.error('❌ Facebook OAuth error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('✅ Facebook OAuth initiated');
    console.log('📤 OAuth data:', data);

    // On mobile, the OAuth should open in the browser
    if (Platform.OS !== 'web' && data.url) {
      console.log('🌐 Opening Facebook OAuth URL in browser:', data.url);
      const canOpen = await Linking.canOpenURL(data.url);
      if (canOpen) {
        await Linking.openURL(data.url);
      } else {
        console.error('❌ Cannot open Facebook OAuth URL');
        throw new Error('Cannot open Facebook OAuth URL');
      }
    }

    return data;
  } catch (error) {
    console.error('Facebook sign in error:', error);
    throw error;
  }
};

// Handle OAuth callback and create profile if needed
export const handleOAuthCallback = async (userType: 'farmer' | 'buyer') => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('No user found after OAuth');
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (existingProfile) {
      console.log('✅ Profile already exists for OAuth user');
      return { user, profile: existingProfile };
    }

    // Create profile for OAuth user
    const profileData: Database['public']['Tables']['profiles']['Insert'] = {
      id: user.id,
      email: user.email || '',
      first_name: user.user_metadata?.full_name?.split(' ')[0] || null,
      last_name: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || null,
      middle_name: null,
      phone: null,
      barangay: null,
      user_type: userType,
      farm_name: null,
      farm_size: null,
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profileData as any);

    if (profileError) {
      console.error('❌ OAuth profile creation error:', profileError);
      throw profileError;
    }

    console.log('✅ OAuth profile created successfully');
    return { user, profile: profileData };
  } catch (error) {
    console.error('OAuth callback error:', error);
    throw error;
  }
};

// Get user profile with auth user
export const getUserWithProfile = async (): Promise<{ user: any; profile: Profile | null } | null> => {
  try {
    // Try to get from session manager first
    const { sessionManager } = await import('./sessionManager');
    const sessionState = sessionManager.getSessionState();

    if (sessionState.isAuthenticated && sessionState.user) {
      console.log('📦 Using cached session data');
      console.log('📦 Profile status:', sessionState.profile ? 'Found' : 'None');
      return {
        user: sessionState.user,
        profile: sessionState.profile
      };
    }

    // Fallback to direct Supabase query
    console.log('🔄 Fetching fresh user data from Supabase');
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return { user, profile: null };
    }

    return { user, profile };
  } catch (error) {
    console.error('Get user with profile error:', error);
    return null;
  }
};