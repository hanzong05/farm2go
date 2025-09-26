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
  private sessionTimeout = Number.MAX_SAFE_INTEGER; // Never expire automatically
  private refreshTimer: number | null = null;
  private activityTimer: number | null = null;
  private listeners: Array<(state: SessionState) => void> = [];
  private isDestroyed = false;

  // Cleanup method to be called when app is being closed/unloaded
  public destroy(): void {
    console.log('🔄 SessionManager: Destroying instance...');
    this.isDestroyed = true;

    // Clear all timers
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }

    // Clear listeners to prevent memory leaks
    this.listeners = [];

    console.log('✅ SessionManager: Instance destroyed');
  }

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
    // Only setup token refresh, no activity monitoring
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
      console.log('🔄 [STEP 1] Initializing session from storage...');

      // First try to load from local storage
      console.log('🔄 [STEP 2] Loading stored session data...');
      const storedSessionData = await this.loadStoredSessionData();
      console.log('📋 [STEP 2] Stored session data result:', !!storedSessionData);

      if (storedSessionData) {
        console.log('📦 Found stored session data, validating...');

        // Always use stored session data - no expiration checks
        console.log('✅ Found stored session, using it (no expiration check)');
        this.sessionData = storedSessionData;
        this.notifyListeners();
        return this.getSessionState();
      }

      // Check if we're using demo/invalid Supabase config
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co';
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key';

      if (supabaseUrl === 'https://demo.supabase.co' || supabaseKey === 'demo-anon-key') {
        console.log('⚠️ [STEP 3] Demo Supabase config detected - skipping session fetch');
        console.log('✅ Session initialization completed (no auth)');
        return this.getSessionState();
      }

      // Fallback to getting session from Supabase
      console.log('🔄 [STEP 3] Getting fresh session from Supabase...');

      // Add timeout protection for Supabase session fetch
      const sessionTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Supabase session fetch timeout'));
        }, 20000); // Increased to 20 second timeout
      });

      const sessionPromise = supabase.auth.getSession();
      const { data: { session }, error } = await Promise.race([sessionPromise, sessionTimeoutPromise]);
      console.log('📋 [STEP 3] Supabase session result:', { hasSession: !!session, error: !!error });

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

      // Skip session expiration checks - keep session active
      console.log('📝 Session found, keeping active regardless of expiration');

      // Get user profile (optional - user might not have profile yet)
      console.log('🔄 [STEP 4] Fetching user profile...');
      const profile = await this.fetchUserProfile(session.user.id);
      console.log('📋 [STEP 4] Profile fetch result:', { hasProfile: !!profile });
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
    // Sessions never expire automatically - only manual logout
    return false;
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

  private async loadStoredSessionData(): Promise<SessionData | null> {
    try {
      const [sessionStr, userStr, profileStr, lastActivityStr, sessionStartStr] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.SESSION),
        AsyncStorage.getItem(this.STORAGE_KEYS.USER),
        AsyncStorage.getItem(this.STORAGE_KEYS.PROFILE),
        AsyncStorage.getItem(this.STORAGE_KEYS.LAST_ACTIVITY),
        AsyncStorage.getItem(this.STORAGE_KEYS.SESSION_START),
      ]);

      if (!sessionStr || !userStr || !lastActivityStr || !sessionStartStr) {
        return null;
      }

      const session = JSON.parse(sessionStr);
      const user = JSON.parse(userStr);
      const profile = profileStr ? JSON.parse(profileStr) : null;
      const lastActivity = parseInt(lastActivityStr);
      const sessionStartTime = parseInt(sessionStartStr);

      return {
        session,
        user,
        profile,
        lastActivity,
        sessionStartTime,
      };
    } catch (error) {
      console.error('❌ Error loading stored session data:', error);
      return null;
    }
  }

  private isStoredSessionExpired(sessionData: SessionData): boolean {
    // Never expire stored sessions - they persist until manual logout
    return false;
  }

  private async fetchUserProfile(userId: string): Promise<Profile | null> {
    try {
      console.log('🔍 Fetching user profile for:', userId);

      // Add timeout protection for profile fetch
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Profile fetch timeout'));
        }, 15000); // 15 second timeout for profile fetch
      });

      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]);

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        return null;
      }

      if (!profile) {
        console.log('ℹ️ No profile found for user');
        return null;
      }

      console.log('✅ Profile fetched successfully:', profile.user_type);
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
    // Activity monitoring disabled - sessions only end on explicit logout
    console.log('📝 Activity monitoring disabled - sessions persist until logout');
  }

  private setupTokenRefresh(): void {
    // Keep token refresh to maintain Supabase connection, but don't clear session on failure
    this.refreshTimer = setInterval(() => {
      if (this.sessionData && !this.isDestroyed) {
        this.refreshSession().catch((error) => {
          console.log('📝 Token refresh failed, but keeping session active:', error.message);
          // Don't clear session - let user continue until manual logout
        });
      }
    }, 45 * 60 * 1000);
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();