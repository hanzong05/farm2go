import { useEffect, useState } from 'react';
import { useRouter, useRootNavigationState } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { safeLocalStorage } from '../../utils/platformUtils';

export default function AuthCallback() {
  const [isClient, setIsClient] = useState(false);
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
    if (!isClient || !isRouterReady) return;
    const handleCallback = async () => {
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
            } else {
              console.log('✅ Code exchange successful');
            }
          } catch (exchangeError) {
            console.error('❌ Code exchange exception:', exchangeError);
          }
          // Brief wait for session establishment
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Quick user verification
        console.log('🔐 Verifying OAuth user...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.error('❌ No OAuth user found:', userError);
          safeNavigate('/auth/login?error=' + encodeURIComponent('OAuth sign-in failed. Please try again.'));
          return;
        }

        console.log('✅ OAuth user verified:', user.email);

        // Clean up OAuth state
        const { sessionManager } = await import('../../services/sessionManager');
        await sessionManager.clearOAuthState();

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

        console.log('✅ OAuth callback completed - letting layout handle navigation');
        // Let the layout handle navigation based on user profile

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
      }
    };

    // Reduced delay for faster processing
    const timer = setTimeout(handleCallback, 1000);
    return () => clearTimeout(timer);
  }, [isClient, isRouterReady]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#10b981" />
      <Text style={styles.loadingText}>Processing sign in...</Text>
      <Text style={styles.subText}>Please wait while we verify your account</Text>
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