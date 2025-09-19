import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { sessionManager, SessionState } from '../services/sessionManager';
import { Database } from '../types/database';

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

    const initSession = async () => {
      try {
        console.log('🔄 SessionProvider: Initializing session...');

        // Subscribe to session changes
        unsubscribe = sessionManager.subscribe((state) => {
          console.log('📡 SessionProvider: Session state updated', {
            isAuthenticated: state.isAuthenticated,
            hasUser: !!state.user,
            hasProfile: !!state.profile,
            userType: state.profile?.user_type,
          });
          setSessionState(state);
        });

        // Initialize session
        await sessionManager.initializeSession();
      } catch (error) {
        console.error('❌ SessionProvider: Error initializing session:', error);
        setSessionState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize session',
        }));
      }
    };

    initSession();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setSessionState(prev => ({ ...prev, isLoading: true, error: null }));

      // Import auth service dynamically to avoid circular dependencies
      const { loginUser } = await import('../services/auth');

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