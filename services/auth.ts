import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType: 'farmer' | 'buyer';
  // Farmer specific
  farmName?: string;
  farmLocation?: string;
  farmSize?: string;
  cropTypes?: string;
  // Buyer specific
  companyName?: string;
  businessType?: string;
  businessLocation?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// Register new user
export const registerUser = async (data: RegisterData) => {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    // Create user profile
    const profileData: Database['public']['Tables']['profiles']['Insert'] = {
      id: authData.user.id,
      email: data.email,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone || null,
      user_type: data.userType as 'farmer' | 'buyer',
      // Farmer fields
      farm_name: data.farmName || null,
      farm_location: data.farmLocation || null,
      farm_size: data.farmSize || null,
      crop_types: data.cropTypes || null,
      // Buyer fields
      company_name: data.companyName || null,
      business_type: data.businessType || null,
      business_location: data.businessLocation || null,
    };

    const { error: profileError } = await (supabase
      .from('profiles') as any)
      .insert(profileData);

    if (profileError) {
      throw profileError;
    }

    return { user: authData.user, profile: profileData };
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Login user
export const loginUser = async (data: LoginData) => {
  try {
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