import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { safeLocalStorage } from '../../utils/platformUtils';

// Global flag to prevent multiple concurrent callback processing
let globalProcessingFlag = false;
let globalLastResetTime = 0;

export default function AuthCallback() {
  const [isProcessing, setIsProcessing] = useState(false);
  const hasProcessedRef = useRef(false);
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Reset global flag if component is mounting fresh (after navigation from deep link handler)
  useEffect(() => {
    const now = Date.now();
    // If more than 1 second has passed since last reset, allow a fresh start
    if (now - globalLastResetTime > 1000) {
      console.log('🔄 Fresh callback mount detected, resetting processing flags');
      globalProcessingFlag = false;
      globalLastResetTime = now;
    }
  }, []);

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
    // If on web, check if this is from mobile app OAuth (using explicit mobile=true param)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isMobileOAuth = urlParams.get('mobile') === 'true';
      const code = urlParams.get('code');
      const hasCode = !!code;

      if (hasCode && isMobileOAuth) {
        // This is mobile OAuth - redirect to app
        console.log('🔗 Mobile OAuth detected (mobile=true), redirecting to app...');

        // Create clean URL without the mobile parameter for the app
        const cleanParams = new URLSearchParams(window.location.search);
        cleanParams.delete('mobile');
        const appUrl = `farm2go://auth/callback?${cleanParams.toString()}`;

        // Try multiple redirect methods for better compatibility

        // Method 1: Direct location change
        setTimeout(() => {
          window.location.href = appUrl;
        }, 100);

        // Method 2: Create invisible iframe (works on some Android browsers)
        setTimeout(() => {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = appUrl;
          document.body.appendChild(iframe);

          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 2000);
        }, 500);

        // Method 3: Create a clickable link as fallback with Chrome intent support
        setTimeout(() => {
          // For Android Chrome, use intent:// URL for better deep link support
          const chromeIntentUrl = `intent://auth/callback?${cleanParams.toString()}#Intent;scheme=farm2go;package=com.hanzpillerva.farm2go;end`;

          const linkDiv = document.createElement('div');
          linkDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:10px;box-shadow:0 4px 6px rgba(0,0,0,0.1);text-align:center;z-index:9999;font-family:system-ui,-apple-system,sans-serif;max-width:90%;';

          // Detect if it's Android
          const isAndroid = /Android/i.test(navigator.userAgent);
          const linkHref = isAndroid ? chromeIntentUrl : appUrl;

          linkDiv.innerHTML = `
            <h3 style="margin:0 0 15px 0;color:#059669;">✓ Sign In Successful!</h3>
            <p style="margin:0 0 15px 0;color:#666;">Tap the button below to return to the app:</p>
            <a href="${linkHref}" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Open Farm2Go App</a>
            <p style="margin:15px 0 0 0;color:#999;font-size:12px;">If the app doesn't open automatically, tap the button above</p>
          `;
          document.body.appendChild(linkDiv);

          // Also try the Chrome intent URL on Android
          if (isAndroid) {
            setTimeout(() => {
              window.location.href = chromeIntentUrl;
            }, 500);
          }
        }, 1500);
      }
    }
  }, []);

  useEffect(() => {
    if (!isRouterReady || isProcessing || hasProcessedRef.current) {
      console.log('⏭️ Skipping callback - already processing or not ready', {
        isRouterReady,
        isProcessing,
        hasProcessed: hasProcessedRef.current
      });
      return;
    }

    let isMounted = true;

    const handleCallback = async () => {
      // Double-check before proceeding
      if (!isMounted || hasProcessedRef.current || globalProcessingFlag) {
        console.log('⏭️ Skipping callback - duplicate call detected');
        return;
      }

      console.log('🔄 OAuth callback starting processing (mounted)...');

      // Set flags IMMEDIATELY to prevent duplicate processing
      globalProcessingFlag = true;
      hasProcessedRef.current = true;
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

        // Implicit flow - session in URL hash
        console.log('⏳ Checking session...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          console.log('❌ No session');
          safeNavigate('/auth/login');
          return;
        }

        console.log('✅ Session found!');

        // Check if user has a profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          console.log('📝 No profile found - redirecting to complete-profile');
          safeNavigate('/auth/complete-profile');
          return;
        }

        console.log('✅ Profile found, redirecting to index');
        safeNavigate('/');

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
        if (isMounted) {
          setIsProcessing(false);
        }
        // Reset global flag after navigation has been initiated
        setTimeout(() => {
          globalProcessingFlag = false;
        }, 2000);
      }
    };

    // Process callback when properly mounted
    handleCallback();

    return () => {
      isMounted = false;
      // Don't clear global flag on unmount - let it clear naturally
      // This prevents navigation from being interrupted
    };
  }, [isRouterReady]); // Only depend on router ready state

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