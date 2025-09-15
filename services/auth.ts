import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

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
  cropTypes?: string;
  // Buyer specific
  companyName?: string;
  businessType?: string;
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
        crop_types: data.cropTypes || null,
        company_name: data.companyName || null,
        business_type: data.businessType || null,
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

    const { data: authData, error: authError } = await Promise.race([
      signupPromise,
      timeoutPromise
    ]) as any;

    console.log('📡 Auth signup response:', {
      user: authData?.user ? 'User created' : 'No user',
      session: authData?.session ? 'Session created' : 'No session',
      error: authError ? authError.message : 'No error'
    });

    if (authError) {
      console.error('❌ Auth signup error:', authError);
      throw authError;
    }

    if (!authData.user) {
      console.error('❌ No user returned from signup');
      throw new Error('Failed to create user');
    }

    console.log('✅ Auth user created successfully:', authData.user.id);

    console.log('📝 Creating user profile...');

    // Create user profile
    const profileData: Database['public']['Tables']['profiles']['Insert'] = {
      id: authData.user.id,
      phone: data.phone,
      first_name: data.firstName,
      middle_name: data.middleName || null,
      last_name: data.lastName,
      barangay: data.barangay,
      user_type: data.userType as 'farmer' | 'buyer',
      // Farmer fields
      farm_name: data.farmName || null,
      farm_size: data.farmSize || null,
      crop_types: data.cropTypes || null,
      // Buyer fields
      company_name: data.companyName || null,
      business_type: data.businessType || null,
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
      const { error: profileError } = await (supabase
        .from('profiles') as any)
        .insert(profileData);

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
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Logout error:', error);
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

// Get user profile with auth user
export const getUserWithProfile = async (): Promise<{ user: any; profile: Profile | null } | null> => {
  try {
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