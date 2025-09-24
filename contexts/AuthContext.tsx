import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

// Check if we're in demo mode
const isDemoMode = !process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL === 'https://demo.supabase.co';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      // Check if we're using demo configuration
      if (isDemoMode) {
        // Return mock profile for demo mode
        return {
          id: userId,
          email: `user${userId}@demo.com`,
          first_name: 'Demo',
          middle_name: null,
          last_name: 'User',
          phone: null,
          barangay: null,
          user_type: 'buyer' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          farm_name: null,
          barangay: null,
          farm_size: null,
          crop_types: null,
          company_name: null,
          business_type: null,
          business_location: null,
        };
      }

      console.log('🔍 Fetching profile for user ID:', userId);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('📊 Profile fetch result:', { data, error });

      if (error) {
        console.error('❌ Error fetching profile:', error);
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });

        // If it's a PGRST116 error (no rows), the profile doesn't exist
        if (error.code === 'PGRST116') {
          console.log('📝 No profile found - user needs to complete profile');
          return null;
        }

        // If it's an RLS error, we have a permissions issue
        if (error.code === '42501') {
          console.error('🔒 RLS policy blocking access - check Supabase policies');
          return null;
        }

        // Other errors
        console.error('⚠️ Unknown profile fetch error');
        return null;
      }

      console.log('✅ Profile found:', data);
      return data;
    } catch (error) {
      console.error('💥 Profile fetch exception:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Get initial session with timeout protection
    const getInitialSession = async () => {
      try {
        // If in demo mode, skip Supabase initialization
        if (isDemoMode) {
          console.log('🚀 Running in demo mode - Supabase authentication disabled');
          if (isMounted) setLoading(false);
          return;
        }

        console.log('🔄 AuthContext: Getting initial session...');

        // Add timeout protection to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session initialization timeout')), 10000);
        });

        const sessionPromise = supabase.auth.getSession();

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;

        if (error) {
          console.error('Error getting session:', error);
        } else if (isMounted) {
          console.log('📦 AuthContext: Session found:', !!session);
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            console.log('👤 AuthContext: Fetching profile for user:', session.user.id);
            const profileData = await fetchProfile(session.user.id);
            console.log('📊 AuthContext: Profile result:', !!profileData);
            if (isMounted) setProfile(profileData);
          }
        }
      } catch (error) {
        console.error('Initial session error:', error);
        // Don't let errors prevent app from loading
      } finally {
        if (isMounted) {
          console.log('✅ AuthContext: Setting loading to false');
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Only listen for auth changes if not in demo mode
    if (!isDemoMode) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!isMounted) return;

          console.log('Auth state changed:', event, session?.user?.id);

          // Prevent unnecessary loading states on token refresh
          if (event === 'TOKEN_REFRESHED') {
            setSession(session);
            setUser(session?.user ?? null);
            return;
          }

          setLoading(true);
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            const profileData = await fetchProfile(session.user.id);
            if (isMounted) setProfile(profileData);
          } else {
            if (isMounted) setProfile(null);
          }

          if (isMounted) setLoading(false);
        }
      );

      return () => {
        isMounted = false;
        subscription?.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const value = {
    user,
    profile,
    session,
    loading,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};