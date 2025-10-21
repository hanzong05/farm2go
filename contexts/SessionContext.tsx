import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { sessionManager, SessionState } from '../services/sessionManager';
import { Database } from '../types/database';
import { supabase } from '../lib/supabase';
import { loginUser } from '../services/auth';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface SessionContextType extends SessionState {
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<{ success: boolean; error?: string }>;
  updateProfile: (profile: Partial<Profile>) => Promise<boolean>;
  updateActivity: () => void;

  // OAuth methods
  storeOAuthState: (state: any) => Promise<void>;
  getOAuthState: () => Promise<any>;
  clearOAuthState: () => Promise<void>;

  // Session info
  getSessionDuration: () => number;
  isSessionExpired: () => boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [sessionState, setSessionState] = useState<SessionState>({
    isAuthenticated: false,
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let fallbackTimeoutId: NodeJS.Timeout;

    // Fallback timeout to ensure loading state is cleared
    fallbackTimeoutId = setTimeout(() => {
      setSessionState({
        isAuthenticated: false,
        user: null,
        profile: null,
        session: null,
        isLoading: false,
        error: null,
      });
    }, 30000); // 30 second fallback to reduce aggressive timeouts

    const initSession = async () => {
      try {
        console.log('🔄 SessionProvider: Initializing session...');

        // AGGRESSIVE BYPASS: Skip sessionManager and use simple fallback
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co';
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key';

        if (supabaseUrl === 'https://demo.supabase.co' || supabaseKey === 'demo-anon-key') {
          console.log('⚠️ SessionProvider: Demo config detected - using fallback state');
          setSessionState({
            isAuthenticated: false,
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            error: null,
          });
          return;
        }

        // Try a simple direct approach instead of sessionManager
        console.log('🔄 SessionProvider: Trying direct Supabase session...');

        const directTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Direct session timeout'));
          }, 15000); // Less aggressive 15 second timeout
        });

        const directSessionPromise = supabase.auth.getSession();

        try {
          const { data: { session }, error } = await Promise.race([directSessionPromise, directTimeoutPromise]);

          if (error || !session) {
            console.log('ℹ️ SessionProvider: No session, using unauthenticated state');
            setSessionState({
              isAuthenticated: false,
              user: null,
              profile: null,
              session: null,
              isLoading: false,
              error: null,
            });
            return;
          }

          console.log('✅ SessionProvider: Direct session found');
          setSessionState({
            isAuthenticated: true,
            user: session.user,
            profile: null, // Skip profile fetch for now
            session,
            isLoading: false,
            error: null,
          });

        } catch (directError) {
          console.log('⚠️ SessionProvider: Direct approach failed, using fallback');
          setSessionState({
            isAuthenticated: false,
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            error: null,
          });
        }

      } catch (error) {
        console.error('❌ SessionProvider: Error initializing session:', error);

        // Clear fallback timeout
        if (fallbackTimeoutId) {
          clearTimeout(fallbackTimeoutId);
        }

        // Handle timeout errors more gracefully
        const errorMessage = error instanceof Error
          ? (error.message.includes('timeout')
            ? 'Session loading is taking longer than usual. Please refresh the page.'
            : error.message)
          : 'Failed to initialize session';

        // Ensure loading state is cleared even on error
        setSessionState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          isAuthenticated: false, // Force to false on timeout
          user: null,
          profile: null,
        }));
      }
    };

    initSession();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (fallbackTimeoutId) {
        clearTimeout(fallbackTimeoutId);
      }
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setSessionState(prev => ({ ...prev, isLoading: true, error: null }));

      const authResult = await loginUser({ email, password });

      if (authResult.user && authResult.session) {
        const sessionCreated = await sessionManager.createSession(authResult.user, authResult.session);

        if (sessionCreated) {
          return { success: true };
        } else {
          return { success: false, error: 'Failed to create session' };
        }
      } else {
        return { success: false, error: 'Invalid login response' };
      }
    } catch (error) {
      console.error('❌ SessionProvider: Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setSessionState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return { success: false, error: errorMessage };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setSessionState(prev => ({ ...prev, isLoading: true }));
      await sessionManager.clearSession();
    } catch (error) {
      console.error('❌ SessionProvider: Logout error:', error);
      // Force clear local state even if logout fails
      setSessionState({
        isAuthenticated: false,
        user: null,
        profile: null,
        session: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      });
    }
  };

  const refreshSession = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      return await sessionManager.refreshSession();
    } catch (error) {
      console.error('❌ SessionProvider: Refresh session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh session'
      };
    }
  };

  const updateProfile = async (profile: Partial<Profile>): Promise<boolean> => {
    try {
      return await sessionManager.updateProfile(profile);
    } catch (error) {
      console.error('❌ SessionProvider: Update profile error:', error);
      return false;
    }
  };

  const updateActivity = (): void => {
    sessionManager.updateLastActivity();
  };

  const storeOAuthState = async (state: any): Promise<void> => {
    try {
      await sessionManager.storeOAuthState(state);
    } catch (error) {
      console.error('❌ SessionProvider: Store OAuth state error:', error);
    }
  };

  const getOAuthState = async (): Promise<any> => {
    try {
      return await sessionManager.getOAuthState();
    } catch (error) {
      console.error('❌ SessionProvider: Get OAuth state error:', error);
      return null;
    }
  };

  const clearOAuthState = async (): Promise<void> => {
    try {
      await sessionManager.clearOAuthState();
    } catch (error) {
      console.error('❌ SessionProvider: Clear OAuth state error:', error);
    }
  };

  const getSessionDuration = (): number => {
    return sessionManager.getSessionDuration();
  };

  const isSessionExpired = (): boolean => {
    return sessionManager.isSessionExpired();
  };

  const contextValue: SessionContextType = {
    // State
    ...sessionState,

    // Actions
    login,
    logout,
    refreshSession,
    updateProfile,
    updateActivity,

    // OAuth methods
    storeOAuthState,
    getOAuthState,
    clearOAuthState,

    // Session info
    getSessionDuration,
    isSessionExpired,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};