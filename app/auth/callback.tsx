import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { safeLocalStorage } from '../../utils/platformUtils';

// Global flag to prevent multiple OAuth processing
let globalOAuthProcessing = false;
let globalOAuthTimestamp = 0;

export default function AuthCallback() {
  const [isClient, setIsClient] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const hasProcessedRef = useRef(false);
  const processingTimestampRef = useRef<number | null>(null);
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Check if router is ready for navigation
  const isRouterReady = navigationState?.key != null;

  // Handle pending navigation once router is ready
  useEffect(() => {
    if (isRouterReady && pendingNavigation) {
      console.log('🚀 AuthCallback: Executing pending navigation:', pendingNavigation);
      router.replace(pendingNavigation);
      setPendingNavigation(null);
    }
  }, [isRouterReady, pendingNavigation, router]);

  // Safe navigation function
  const safeNavigate = (path: string) => {
    if (isRouterReady) {
      console.log('🚀 AuthCallback: Safe navigation to:', path);
      router.replace(path);
    } else {
      console.log('⏳ AuthCallback: Router not ready, queuing navigation:', path);
      setPendingNavigation(path);
    }
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !isRouterReady || isProcessing || hasProcessedRef.current) return;

    // Global check to prevent any duplicate processing across all instances
    const now = Date.now();
    if (globalOAuthProcessing && (now - globalOAuthTimestamp) < 1500) {
      console.log('⏭️ OAuth callback: Skipping - global processing active (within 1.5s)');
      return;
    }

    // If processing was recent (even if still active), check and navigate
    if (globalOAuthTimestamp && (now - globalOAuthTimestamp) < 10000) {
      console.log('✅ OAuth callback: Recent processing detected, checking session and navigating...');
      // Mark as processed to prevent further attempts
      hasProcessedRef.current = true;

      // Processing is ongoing or done, check session and navigate
      const checkAndNavigate = async () => {
        try {
          // Wait longer for the first instance to complete
          await new Promise(resolve => setTimeout(resolve, 1000));

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();

            if (profile) {
              console.log('✅ Profile found, navigating based on user type:', profile.user_type);
              switch (profile.user_type) {
                case 'super-admin':
                  safeNavigate('/super-admin');
                  break;
                case 'admin':
                  safeNavigate('/admin/users');
                  break;
                default:
                  safeNavigate('/');
              }
            } else {
              console.log('📝 No profile found, redirecting to registration');
              safeNavigate('/auth/register?oauth=true&email=' + encodeURIComponent(user.email || ''));
            }
          } else {
            console.log('⏳ No user yet, waiting for first instance to complete...');
          }
        } catch (error) {
          console.error('Navigation check error:', error);
        }
      };
      checkAndNavigate();
      return;
    }

    // Additional local check
    if (processingTimestampRef.current && (now - processingTimestampRef.current) < 5000) {
      console.log('⏭️ OAuth callback: Skipping duplicate processing (within 5s)');
      return;
    }

    let isMounted = true;

    const handleCallback = async () => {
      if (!isMounted || isProcessing || hasProcessedRef.current || globalOAuthProcessing) return;

      // Final check before processing
      const checkTime = Date.now();
      if (globalOAuthProcessing || (globalOAuthTimestamp && (checkTime - globalOAuthTimestamp) < 10000)) {
        console.log('⏭️ OAuth callback: Aborting - global processing detected');
        return;
      }

      console.log('🔄 OAuth callback starting processing (mounted)...');

      // Set global and local flags
      globalOAuthProcessing = true;
      globalOAuthTimestamp = checkTime;
      hasProcessedRef.current = true;
      processingTimestampRef.current = checkTime;
      setIsProcessing(true);
      try {
        console.log('🔄 OAuth callback processing...');

        // Clear any stale storage state
        try {
          const storedTimestamp = safeLocalStorage.getItem('oauth_timestamp');
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

          if (storedTimestamp && parseInt(storedTimestamp) < fiveMinutesAgo) {
            safeLocalStorage.removeItem('oauth_user_type');
            safeLocalStorage.removeItem('oauth_intent');
            safeLocalStorage.removeItem('oauth_timestamp');
          }
        } catch (error) {
          console.log('Storage cleanup error:', error);
        }

        // Check for authorization code and exchange if needed
        let authorizationCode = null;
        if (Platform.OS !== 'web') {
          try {
            authorizationCode = await AsyncStorage.getItem('oauth_authorization_code');
            if (authorizationCode) {
              console.log('🔑 Found authorization code from deep link');
              await AsyncStorage.removeItem('oauth_authorization_code');
            }
          } catch (error) {
            console.log('Error checking auth code:', error);
          }
        } else if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          authorizationCode = urlParams.get('code');
        }

        if (authorizationCode) {
          console.log('🔑 Exchanging authorization code...');
          try {
            const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authorizationCode);
            if (exchangeError) {
              console.error('❌ Code exchange error:', exchangeError);
              // Handle specific auth code errors
              if (exchangeError.message?.includes('invalid request') || exchangeError.message?.includes('code verifier')) {
                console.log('🔄 Auth code exchange failed, checking for existing session...');
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                  console.log('✅ Found existing valid session, proceeding...');
                } else {
                  console.log('❌ No valid session found, redirecting to login');
                  safeNavigate('/auth/login?error=auth_expired');
                  return;
                }
              }
            } else {
              console.log('✅ Code exchange successful');
            }
          } catch (exchangeError) {
            console.error('❌ Code exchange exception:', exchangeError);
            // Check for existing session on exception
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.user) {
                safeNavigate('/auth/login?error=auth_failed');
                return;
              }
            } catch (sessionError) {
              console.error('❌ Session check failed:', sessionError);
              safeNavigate('/auth/login?error=auth_failed');
              return;
            }
          }
        } else {
          // No auth code - check for existing session
          console.log('🔍 No auth code found, checking existing session...');
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
              console.log('❌ No valid session found');
              safeNavigate('/auth/login?error=no_session');
              return;
            } else {
              console.log('✅ Valid session found, proceeding...');
            }
          } catch (sessionError) {
            console.error('❌ Session check failed:', sessionError);
            safeNavigate('/auth/login?error=session_check_failed');
            return;
          }
        }

        // OAuth processing complete - check for profile
        console.log('✅ OAuth code exchange completed, checking user profile');

        // Check if user has a profile
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          console.log('👤 User authenticated, checking profile...');
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profileError || !profile) {
            console.log('📝 No profile found - redirecting to profile creation');

            // Clean up OAuth state
            try {
              const { sessionManager } = await import('../../services/sessionManager');
              await sessionManager.clearOAuthState();
            } catch (error) {
              console.log('Session manager cleanup error:', error);
            }

            // Clean up legacy storage
            try {
              await AsyncStorage.removeItem('oauth_user_type');
              await AsyncStorage.removeItem('oauth_intent');
              safeLocalStorage.removeItem('oauth_user_type');
              safeLocalStorage.removeItem('oauth_intent');
              safeLocalStorage.removeItem('oauth_timestamp');
            } catch (error) {
              console.log('Storage cleanup error:', error);
            }

            // Redirect to registration/profile creation
            safeNavigate('/auth/register?oauth=true&email=' + encodeURIComponent(user.email || ''));
            return;
          }

          console.log('✅ Profile found, user_type:', profile.user_type);

          // Clean up OAuth state
          try {
            const { sessionManager } = await import('../../services/sessionManager');
            await sessionManager.clearOAuthState();
          } catch (error) {
            console.log('Session manager cleanup error:', error);
          }

          // Clean up legacy storage
          try {
            await AsyncStorage.removeItem('oauth_user_type');
            await AsyncStorage.removeItem('oauth_intent');
            safeLocalStorage.removeItem('oauth_user_type');
            safeLocalStorage.removeItem('oauth_intent');
            safeLocalStorage.removeItem('oauth_timestamp');
          } catch (error) {
            console.log('Storage cleanup error:', error);
          }

          // Redirect based on user type
          switch (profile.user_type) {
            case 'super-admin':
              console.log('🚀 Redirecting to super-admin dashboard');
              safeNavigate('/super-admin');
              break;
            case 'admin':
              console.log('🚀 Redirecting to admin dashboard');
              safeNavigate('/admin/users');
              break;
            default:
              console.log('🚀 Redirecting to marketplace');
              safeNavigate('/');
          }
        } else {
          console.log('❌ No user found after OAuth');
          safeNavigate('/auth/login?error=no_user');
        }

      } catch (error: any) {
        console.error('❌ OAuth callback error:', error);

        // Clean up on error
        try {
          await AsyncStorage.removeItem('oauth_user_type');
          await AsyncStorage.removeItem('oauth_intent');
          safeLocalStorage.removeItem('oauth_user_type');
          safeLocalStorage.removeItem('oauth_intent');
          safeLocalStorage.removeItem('oauth_timestamp');
        } catch (cleanupError) {
          console.log('Cleanup error:', cleanupError);
        }

        safeNavigate(`/auth/login?error=${encodeURIComponent(error.message || 'OAuth sign-in failed. Please try again.')}`);
      } finally {
        // Only clear global flag after a delay to allow navigation to complete
        setTimeout(() => {
          globalOAuthProcessing = false;
        }, 1000);

        if (isMounted) {
          setIsProcessing(false);
        }
      }
    };

    // Process callback when properly mounted
    handleCallback();

    return () => {
      isMounted = false;
      // Don't clear global flag on unmount - let it clear naturally
      // This prevents navigation from being interrupted
    };
  }, [isClient, isRouterReady]); // Remove isProcessing and hasProcessed from deps

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#10b981" />
      <Text style={styles.loadingText}>
        {isProcessing ? 'Processing sign in...' : 'Preparing...'}
      </Text>
      <Text style={styles.subText}>
        {isProcessing
          ? 'Please wait while we verify your account'
          : 'Getting ready to sign you in'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});