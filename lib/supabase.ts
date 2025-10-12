import { createClient } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';
import { Database } from '../types/database';

// Use demo/placeholder values if environment variables are not set
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key';

// Log a warning if using demo values
if (supabaseUrl === 'https://demo.supabase.co' || supabaseAnonKey === 'demo-anon-key') {
  console.warn('⚠️ Using demo Supabase configuration. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables for production.');
}

// Configure WebBrowser for OAuth
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    flowType: Platform.OS === 'web' ? 'implicit' : 'pkce', // Use implicit for web, PKCE for mobile
    storage: Platform.OS !== 'web' ? require('@react-native-async-storage/async-storage').default : undefined,
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    timeout: 30000,
    heartbeatIntervalMs: 30000,
  },
});

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper function to get user profile
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
};

// Custom OAuth function using WebBrowser for in-app authentication
export const signInWithGoogleOAuth = async (userType: string, intent: string = 'registration') => {
  try {
    console.log('🔥 signInWithGoogleOAuth function called!');
    console.log('🔄 Starting in-app Google OAuth for:', userType);

    // Store user type and intent for callback
    if (Platform.OS !== 'web') {
      // Use AsyncStorage for mobile
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.default.setItem('oauth_user_type', userType);
      await AsyncStorage.default.setItem('oauth_intent', intent);
      await AsyncStorage.default.setItem('oauth_timestamp', Date.now().toString());
    } else {
      // Use localStorage for web
      try {
        localStorage.setItem('oauth_user_type', userType);
        localStorage.setItem('oauth_intent', intent);
        localStorage.setItem('oauth_timestamp', Date.now().toString());
      } catch (e) {
        console.log('localStorage not available, proceeding without storing state');
      }
    }

    // For mobile, use WebBrowser to handle OAuth properly
    if (Platform.OS !== 'web') {
      console.log('📱 Using WebBrowser for in-app OAuth on mobile');

      // Start OAuth flow and get the URL - use deep link directly
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'farm2go://auth/callback',
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('❌ OAuth URL generation error:', error);
        console.error('❌ OAuth error details:', JSON.stringify(error, null, 2));

        // Return error details instead of throwing to help debug
        return {
          success: false,
          error: `OAuth setup failed: ${error.message}`,
          errorDetails: error,
          sessionData: null
        };
      }

      console.log('✅ OAuth URL received:', data.url);

      if (data.url) {
        console.log('🌐 Opening OAuth URL in browser...');
        console.log('🔗 OAuth URL:', data.url);
        console.log('🔗 Redirect URL:', 'farm2go://auth/callback');

        // For Android, use system browser for better redirect handling
        if (Platform.OS === 'android') {
          console.log('📱 Android: Opening OAuth in system browser');
          console.log('🔗 Redirect URL configured: farm2go://auth/callback');
          console.log('🔗 Full OAuth URL:', data.url);

          // Open in system browser
          const canOpen = await Linking.canOpenURL(data.url);
          if (canOpen) {
            await Linking.openURL(data.url);

            // Return immediately - the deep link handler will catch the callback
            console.log('✅ OAuth opened in system browser, waiting for callback...');
            console.log('⏳ Waiting for deep link: farm2go://auth/callback?code=...');
            return {
              ...data,
              success: true,
              pending: true,
              message: 'OAuth opened in browser, waiting for callback'
            };
          } else {
            console.error('❌ Cannot open OAuth URL');
            return {
              ...data,
              success: false,
              error: 'Cannot open OAuth URL',
              sessionData: null
            };
          }
        }

        // For iOS, use WebBrowser (in-app) with error handling
        let result;
        try {
          result = await WebBrowser.openAuthSessionAsync(
            data.url,
            'https://farm2go.vercel.app/auth/callback'
          );

          console.log('🌐 WebBrowser result:', result);
          console.log('🌐 Result type:', result.type);

          console.log('🔍 WebBrowser result type:', result.type);
        } catch (webBrowserError: any) {
          console.log('⚠️ WebBrowser error (this may be normal for successful OAuth):', webBrowserError.message);

          // Check if we have a session despite the WebBrowser error
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (session && !sessionError) {
            console.log('✅ OAuth session found despite WebBrowser error - treating as success');
            return { ...data, sessionData: { user: session.user, session } };
          } else {
            console.log('❌ No valid session found after WebBrowser error');
            // Don't throw error - return failure result instead to prevent crash
            return {
              ...data,
              success: false,
              error: 'OAuth was interrupted or cancelled',
              sessionData: null
            };
          }
        }

        // Handle dismissal - user closed the browser before completing
        if (result && result.type === 'dismiss') {
          console.log('ℹ️ WebBrowser was dismissed - checking if OAuth completed anyway');

          // Wait longer for deep link processing and callback handling
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Check for authorization code that might have been stored by deep link handler
          const AsyncStorage = await import('@react-native-async-storage/async-storage');
          const storedCode = await AsyncStorage.default.getItem('oauth_authorization_code');

          if (storedCode) {
            try {
              // Exchange the code for session
              const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(storedCode);

              // Clean up the stored code
              await AsyncStorage.default.removeItem('oauth_authorization_code');

              if (exchangeError) {
                return {
                  ...data,
                  success: false,
                  error: 'OAuth code exchange failed',
                  sessionData: null
                };
              }

              return { ...data, sessionData, success: true };

            } catch (error) {
              // Fall through to session check
            }
          }

          // Check if we have a session despite dismissal (OAuth might have completed)
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (session && !sessionError) {
            console.log('✅ OAuth session found after dismissal - treating as success');
            return { ...data, sessionData: { user: session.user, session }, success: true };
          } else {
            console.log('ℹ️ No session found after dismissal - OAuth was likely cancelled');
            return {
              ...data,
              success: false,
              error: 'OAuth was cancelled by user',
              sessionData: null
            };
          }
        }

        if (result && result.type === 'success') {
          console.log('✅ OAuth completed successfully');
          console.log('🔍 Result URL:', result.url);

          // The WebBrowser result should contain the callback with authorization code
          if (result.url) {
            console.log('🔗 Processing callback URL...');

            try {
              const url = new URL(result.url);
              const code = url.searchParams.get('code');
              const access_token = url.searchParams.get('access_token');
              const refresh_token = url.searchParams.get('refresh_token');

              console.log('🔑 Extracted from URL:', {
                code: !!code,
                access_token: !!access_token,
                refresh_token: !!refresh_token
              });

              if (access_token && refresh_token) {
                // Direct tokens (older flow)
                console.log('✅ Direct tokens found, setting session...');

                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                  access_token,
                  refresh_token
                });

                if (sessionError) {
                  console.error('❌ Error setting session:', sessionError);
                  throw sessionError;
                }

                console.log('✅ Session set successfully');
                console.log('👤 User ID:', sessionData?.user?.id);
                console.log('📧 User email:', sessionData?.user?.email);

                // Import SessionManager and create session
                if (sessionData?.session && sessionData?.user) {
                  try {
                    const { sessionManager } = await import('../services/sessionManager');
                    const sessionCreated = await sessionManager.createSession(sessionData.user, sessionData.session);
                    console.log('🔄 SessionManager create result:', sessionCreated);
                  } catch (smError) {
                    console.error('❌ SessionManager error:', smError);
                    // Continue anyway, the auth state change will handle it
                  }
                }

                return { ...data, authSession: result, sessionData };
              } else if (code) {
                // PKCE flow - exchange code for tokens
                console.log('🔄 Authorization code found, exchanging for tokens...');
                console.log('🔍 Code value:', code);

                try {
                  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

                  if (exchangeError) {
                    console.error('❌ Error exchanging code for session:', exchangeError);
                    console.error('❌ Exchange error details:', JSON.stringify(exchangeError, null, 2));
                    throw exchangeError;
                  }

                  console.log('✅ Code exchanged successfully');
                  console.log('👤 User ID:', sessionData?.user?.id);
                  console.log('📧 User email:', sessionData?.user?.email);
                  console.log('🔑 Session expires at:', sessionData?.session?.expires_at);

                  // Import SessionManager and create session
                  if (sessionData?.session && sessionData?.user) {
                    try {
                      const { sessionManager } = await import('../services/sessionManager');
                      const sessionCreated = await sessionManager.createSession(sessionData.user, sessionData.session);
                      console.log('🔄 SessionManager create result:', sessionCreated);

                      // Also check if session manager has the session data
                      const currentState = sessionManager.getSessionState();
                      console.log('🔍 SessionManager state after creation:', {
                        isAuthenticated: currentState.isAuthenticated,
                        hasUser: !!currentState.user,
                        hasProfile: !!currentState.profile
                      });

                    } catch (smError) {
                      console.error('❌ SessionManager error:', smError);
                      // Continue anyway, the auth state change will handle it
                    }
                  }

                  // Return with sessionData property for login page to handle
                  return {
                    ...data,
                    authSession: result,
                    sessionData: sessionData || null,
                    success: true
                  };
                } catch (codeExchangeError) {
                  console.error('❌ Code exchange failed:', codeExchangeError);
                  // Return without sessionData but with error info
                  return {
                    ...data,
                    authSession: result,
                    sessionData: null,
                    success: false,
                    error: codeExchangeError
                  };
                }
              } else {
                console.log('⚠️ No tokens or code found in callback URL');
                console.log('🔍 URL search params:', Array.from(url.searchParams.entries()));
                return { ...data, authSession: result };
              }
            } catch (urlError) {
              console.error('❌ Error parsing callback URL:', urlError);
              console.log('🔍 Raw URL:', result.url);
              return { ...data, authSession: result };
            }
          }

          return { ...data, authSession: result };
        } else if (result && result.type === 'cancel') {
          console.log('ℹ️ OAuth cancelled by user');
          return {
            ...data,
            success: false,
            error: 'OAuth was cancelled by user',
            sessionData: null
          };
        } else {
          console.log('❌ OAuth failed or incomplete');
          return {
            ...data,
            success: false,
            error: 'OAuth failed or incomplete',
            sessionData: null
          };
        }
      } else {
        throw new Error('No OAuth URL received');
      }
    } else {
      // For web, use implicit flow (no PKCE, no verifier needed)
      console.log('🌐 Web: Starting OAuth with implicit flow...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://farm2go.vercel.app/auth/callback',
        },
      });

      if (error) {
        console.error('❌ OAuth error:', error);
        throw error;
      }

      // Auto-redirects immediately
      return data;
    }

  } catch (error: any) {
    console.error('❌ signInWithGoogleOAuth error:', error);
    throw new Error(error.message || 'OAuth failed');
  }
};