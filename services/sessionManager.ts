import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { safeLocalStorage, memoryUtils } from '../utils/platformUtils';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface SessionData {
  user: User;
  profile: Profile;
  session: Session;
  lastActivity: number;
  sessionStartTime: number;
}

export interface SessionState {
  isAuthenticated: boolean;
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

class SessionManager {
  private static instance: SessionManager;
  private sessionData: SessionData | null = null;
  private sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  private refreshTimer: number | null = null;
  private activityTimer: number | null = null;
  private listeners: Array<(state: SessionState) => void> = [];
  private isDestroyed = false;

  // Storage keys
  private readonly STORAGE_KEYS = {
    SESSION: 'farm2go_session',
    USER: 'farm2go_user',
    PROFILE: 'farm2go_profile',
    LAST_ACTIVITY: 'farm2go_last_activity',
    SESSION_START: 'farm2go_session_start',
    OAUTH_STATE: 'farm2go_oauth_state',
  };

  private constructor() {
    this.setupActivityMonitoring();
    this.setupTokenRefresh();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Subscribe to session state changes
  public subscribe(callback: (state: SessionState) => void): () => void {
    if (this.isDestroyed) {
      console.warn('SessionManager is destroyed, cannot subscribe');
      return () => {};
    }

    this.listeners.push(callback);
    // Immediately call with current state
    try {
      callback(this.getSessionState());
    } catch (error) {
      console.error('Error in initial session state callback:', error);
    }

    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Notify all listeners of state changes
  private notifyListeners(): void {
    if (this.isDestroyed) return;

    const state = this.getSessionState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in session listener:', error);
      }
    });
  }

  // Get current session state
  public getSessionState(): SessionState {
    return {
      isAuthenticated: !!this.sessionData,
      user: this.sessionData?.user || null,
      profile: this.sessionData?.profile || null,
      session: this.sessionData?.session || null,
      isLoading: false,
      error: null,
    };
  }

  // Initialize session from storage
  public async initializeSession(): Promise<SessionState> {
    try {
      console.log('🔄 Initializing session from storage...');

      // Try to get session from Supabase first
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('❌ Error getting session from Supabase:', error);
        await this.clearSession();
        return this.getSessionState();
      }

      if (!session) {
        console.log('ℹ️ No active session found');
        await this.clearStoredSession();
        return this.getSessionState();
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        console.log('⏰ Session expired, attempting refresh...');
        const refreshResult = await this.refreshSession();
        if (!refreshResult.success) {
          await this.clearSession();
          return this.getSessionState();
        }
        return this.getSessionState();
      }

      // Get user profile (optional - user might not have profile yet)
      const profile = await this.fetchUserProfile(session.user.id);
      if (!profile) {
        console.log('⚠️ No profile found for user during initialization - user needs to complete profile');
        // Don't clear session - allow OAuth users without profiles to continue
      }

      const currentTime = Date.now();

      // Create session data (profile can be null for new OAuth users)
      this.sessionData = {
        user: session.user,
        profile: profile || null,
        session,
        lastActivity: currentTime,
        sessionStartTime: currentTime,
      };

      // Update activity immediately to prevent race conditions
      this.updateLastActivity();

      // Store session data
      await this.storeSessionData();

      console.log('✅ Session initialized successfully');
      console.log('👤 User:', session.user.email);
      console.log('🏷️ User type:', profile?.user_type || 'No profile');
      console.log('⏰ Session start time:', new Date(currentTime).toISOString());

      this.notifyListeners();

      return this.getSessionState();
    } catch (error) {
      console.error('❌ Error initializing session:', error);
      await this.clearSession();
      return this.getSessionState();
    }
  }

  // Create new session after login
  public async createSession(user: User, session: Session): Promise<boolean> {
    try {
      console.log('🔄 Creating new session...');

      // Fetch user profile (optional - user might not have profile yet)
      const profile = await this.fetchUserProfile(user.id);
      if (!profile) {
        console.log('⚠️ No profile found for user during session creation - user needs to complete profile');
        // Don't fail - create session without profile for OAuth users
      }

      const currentTime = Date.now();

      // Create session data (profile can be null for new OAuth users)
      this.sessionData = {
        user,
        profile: profile || null,
        session,
        lastActivity: currentTime,
        sessionStartTime: currentTime,
      };

      // Update activity immediately to prevent race conditions
      this.updateLastActivity();

      // Store session data
      await this.storeSessionData();

      console.log('✅ Session created successfully');
      console.log('👤 User:', user.email);
      console.log('🏷️ User type:', profile?.user_type || 'No profile');
      console.log('⏰ Session start time:', new Date(currentTime).toISOString());

      this.notifyListeners();

      return true;
    } catch (error) {
      console.error('❌ Error creating session:', error);
      return false;
    }
  }

  // Update user profile in session
  public async updateProfile(updatedProfile: Partial<Profile>): Promise<boolean> {
    try {
      if (!this.sessionData) {
        console.error('❌ No active session to update profile');
        return false;
      }

      // Update profile in session
      this.sessionData.profile = { ...this.sessionData.profile, ...updatedProfile };

      // Store updated session data
      await this.storeSessionData();

      console.log('✅ Profile updated in session');
      this.notifyListeners();

      return true;
    } catch (error) {
      console.error('❌ Error updating profile in session:', error);
      return false;
    }
  }

  // Clear session and logout
  public async clearSession(): Promise<void> {
    try {
      console.log('🔄 SessionManager: Clearing session...');

      // Clear timers
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
        console.log('🔄 SessionManager: Refresh timer cleared');
      }
      if (this.activityTimer) {
        clearInterval(this.activityTimer);
        this.activityTimer = null;
        console.log('🔄 SessionManager: Activity timer cleared');
      }

      // Sign out from Supabase
      console.log('🔄 SessionManager: Signing out from Supabase...');
      await supabase.auth.signOut();
      console.log('✅ SessionManager: Supabase signout completed');

      // Clear session data
      this.sessionData = null;
      console.log('🔄 SessionManager: Session data cleared');

      // Clear stored data
      await this.clearStoredSession();
      console.log('🔄 SessionManager: Stored session data cleared');

      console.log('✅ SessionManager: Session cleared successfully');
      this.notifyListeners();
    } catch (error) {
      console.error('❌ SessionManager: Error clearing session:', error);
      // Still clear local data even if Supabase signout fails
      this.sessionData = null;
      await this.clearStoredSession();
      this.notifyListeners();
      console.log('🔄 SessionManager: Local data cleared despite error');
    }
  }

  // Refresh session token
  public async refreshSession(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 Refreshing session token...');

      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (error || !session) {
        console.error('❌ Error refreshing session:', error);
        return { success: false, error: error?.message || 'Failed to refresh session' };
      }

      if (this.sessionData) {
        // Update session data with new tokens
        this.sessionData.session = session;
        this.sessionData.user = session.user;
        await this.storeSessionData();
      }

      console.log('✅ Session refreshed successfully');
      this.notifyListeners();

      return { success: true };
    } catch (error) {
      console.error('❌ Error refreshing session:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Update last activity timestamp
  public updateLastActivity(): void {
    if (this.sessionData) {
      this.sessionData.lastActivity = Date.now();
      // Store updated activity time
      AsyncStorage.setItem(this.STORAGE_KEYS.LAST_ACTIVITY, this.sessionData.lastActivity.toString());
    }
  }

  // Check if session is expired
  public isSessionExpired(): boolean {
    if (!this.sessionData) return true;

    const now = Date.now();
    const timeSinceActivity = now - this.sessionData.lastActivity;
    const sessionAge = now - this.sessionData.sessionStartTime;

    // Don't expire sessions that are less than 5 minutes old, regardless of activity
    if (sessionAge < 5 * 60 * 1000) {
      return false;
    }

    return timeSinceActivity > this.sessionTimeout;
  }

  // Get session duration
  public getSessionDuration(): number {
    if (!this.sessionData) return 0;
    return Date.now() - this.sessionData.sessionStartTime;
  }

  // Store OAuth state for cross-page OAuth flows
  public async storeOAuthState(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.OAUTH_STATE, JSON.stringify({
        ...state,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('❌ Error storing OAuth state:', error);
    }
  }

  // Retrieve OAuth state
  public async getOAuthState(): Promise<any> {
    try {
      const storedState = await AsyncStorage.getItem(this.STORAGE_KEYS.OAUTH_STATE);
      if (!storedState) return null;

      const state = JSON.parse(storedState);

      // Check if state is expired (older than 10 minutes)
      if (Date.now() - state.timestamp > 10 * 60 * 1000) {
        await AsyncStorage.removeItem(this.STORAGE_KEYS.OAUTH_STATE);
        return null;
      }

      return state;
    } catch (error) {
      console.error('❌ Error retrieving OAuth state:', error);
      return null;
    }
  }

  // Clear OAuth state
  public async clearOAuthState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEYS.OAUTH_STATE);
    } catch (error) {
      console.error('❌ Error clearing OAuth state:', error);
    }
  }

  // Private helper methods

  private async fetchUserProfile(userId: string): Promise<Profile | null> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        console.error('❌ Error fetching user profile:', error);
        return null;
      }

      return profile;
    } catch (error) {
      console.error('❌ Error in fetchUserProfile:', error);
      return null;
    }
  }

  private async storeSessionData(): Promise<void> {
    try {
      if (!this.sessionData) return;

      const storageOperations = [
        AsyncStorage.setItem(this.STORAGE_KEYS.SESSION, JSON.stringify(this.sessionData.session)),
        AsyncStorage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(this.sessionData.user)),
        AsyncStorage.setItem(this.STORAGE_KEYS.LAST_ACTIVITY, this.sessionData.lastActivity.toString()),
        AsyncStorage.setItem(this.STORAGE_KEYS.SESSION_START, this.sessionData.sessionStartTime.toString()),
      ];

      // Only store profile if it exists, otherwise remove it
      if (this.sessionData.profile) {
        storageOperations.push(
          AsyncStorage.setItem(this.STORAGE_KEYS.PROFILE, JSON.stringify(this.sessionData.profile))
        );
      } else {
        storageOperations.push(
          AsyncStorage.removeItem(this.STORAGE_KEYS.PROFILE)
        );
      }

      await Promise.all(storageOperations);
    } catch (error) {
      console.error('❌ Error storing session data:', error);
    }
  }

  private async clearStoredSession(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEYS.SESSION),
        AsyncStorage.removeItem(this.STORAGE_KEYS.USER),
        AsyncStorage.removeItem(this.STORAGE_KEYS.PROFILE),
        AsyncStorage.removeItem(this.STORAGE_KEYS.LAST_ACTIVITY),
        AsyncStorage.removeItem(this.STORAGE_KEYS.SESSION_START),
        AsyncStorage.removeItem(this.STORAGE_KEYS.OAUTH_STATE),
      ]);

      // Also clear legacy OAuth storage
      await Promise.all([
        AsyncStorage.removeItem('oauth_user_type'),
        AsyncStorage.removeItem('oauth_intent'),
      ]);

      // Clear localStorage for web
      safeLocalStorage.removeItem('oauth_user_type');
      safeLocalStorage.removeItem('oauth_intent');
      safeLocalStorage.removeItem('oauth_timestamp');
    } catch (error) {
      console.error('❌ Error clearing stored session:', error);
    }
  }

  private setupActivityMonitoring(): void {
    // Check for expired sessions every minute
    this.activityTimer = setInterval(() => {
      if (this.isSessionExpired()) {
        console.log('⏰ Session expired due to inactivity');
        this.clearSession();
      }
    }, 60 * 1000);
  }

  private setupTokenRefresh(): void {
    // Refresh token every 50 minutes (tokens expire in 1 hour)
    this.refreshTimer = setInterval(() => {
      if (this.sessionData) {
        this.refreshSession().catch(error => {
          console.error('❌ Auto-refresh failed:', error);
          // Don't automatically clear session on auto-refresh failure
          // Let the user try to refresh manually or continue until expiry
        });
      }
    }, 50 * 60 * 1000);
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();