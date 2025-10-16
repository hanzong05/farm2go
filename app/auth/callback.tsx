import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

// Prevent double execution
let isProcessing = false;

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState('Completing sign in...');
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double mount execution
    if (hasRun.current || isProcessing) {
      console.log('⏭️ Skipping - already processing');
      return;
    }

    hasRun.current = true;
    isProcessing = true;

    handleCallback().finally(() => {
      setTimeout(() => {
        isProcessing = false;
      }, 2000);
    });
  }, []);

  const handleCallback = async () => {
    try {
      setStatus('Processing authentication...');
      console.log('🔄 Processing OAuth callback...');
      console.log('📦 Params:', params);

      // On mobile, manually parse tokens from URL fragment
      if (Platform.OS !== 'web') {
        // Get URL from global variable (set by deep link handler)
        let url = (global as any).oauthCallbackUrl;

        console.log('📱 URL from global:', url?.substring(0, 100) + '...');

        // Fallback to getInitialURL if not in global
        if (!url) {
          url = await Linking.getInitialURL();
          console.log('📱 URL from getInitialURL:', url?.substring(0, 100) + '...');
        }

        console.log('📱 Final deep link URL:', url?.substring(0, 100) + '...');

        if (url && url.includes('#access_token=')) {
          console.log('🔑 Found access token in URL fragment');

          // Extract fragment (everything after #)
          const fragment = url.split('#')[1];
          const fragmentParams = new URLSearchParams(fragment);

          const accessToken = fragmentParams.get('access_token');
          const refreshToken = fragmentParams.get('refresh_token');
          const expiresIn = fragmentParams.get('expires_in');

          console.log('🔑 Access token:', accessToken ? accessToken.substring(0, 20) + '...' : 'none');
          console.log('🔑 Refresh token:', refreshToken ? 'found' : 'none');

          if (accessToken && refreshToken) {
            setStatus('Setting up session...');
            console.log('🔄 Manually storing tokens in AsyncStorage...');

            try {
              // Parse the JWT to get user info
              const payload = JSON.parse(atob(accessToken.split('.')[1]));
              const userId = payload.sub;
              const expiresAt = payload.exp;

              console.log('👤 User ID:', userId);
              console.log('⏰ Expires at:', new Date(expiresAt * 1000).toLocaleString());

              // Build user object in Supabase's expected format
              const user = {
                id: payload.sub,
                aud: payload.aud,
                role: payload.role,
                email: payload.email,
                phone: payload.phone || '',
                app_metadata: payload.app_metadata || {},
                user_metadata: payload.user_metadata || {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              // Manually store the session in AsyncStorage (Supabase's storage key format)
              const sessionData = {
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: parseInt(expiresIn || '3600'),
                expires_at: expiresAt,
                token_type: 'bearer',
                user: user
              };

              const storageKey = `sb-lipviwhsjgvcmdggecqn-auth-token`;
              await AsyncStorage.setItem(storageKey, JSON.stringify(sessionData));
              console.log('✅ Session stored in AsyncStorage');
              console.log('✅ Stored user ID:', user.id);

              // Clear global variable
              delete (global as any).oauthCallbackUrl;

              // Now get the session from Supabase (it should read from AsyncStorage)
              console.log('🔄 Reading session from Supabase...');
              const { data: { session } } = await supabase.auth.getSession();

              if (session) {
                console.log('✅ Session loaded:', session.user.email);

                console.log('🔍 Checking profile...');
                const profile = await checkProfile(session);
                console.log('📋 Profile result:', profile);

                console.log('🚀 Navigating...');
                navigate(profile);
                console.log('✅ Navigation complete');
              } else {
                console.log('⚠️ Session not loaded, but tokens stored - navigating to home');
                router.replace('/');
              }
              return;
            } catch (error: any) {
              console.error('❌ Error storing session:', error);
              router.replace('/auth/login?error=Failed to complete sign in.');
              return;
            }
          }
        }
      }

      // Fallback: try to get existing session (for web or if tokens weren't in URL)
      setStatus('Verifying session...');
      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        console.error('❌ No session found:', error);
        router.replace('/auth/login?error=Sign in failed. Please try again.');
        return;
      }

      console.log('✅ Session found:', session.user.email);
      const profile = await checkProfile(session);
      navigate(profile);
    } catch (error) {
      console.error('❌ Callback error:', error);
      router.replace('/auth/login?error=An error occurred. Please try again.');
    }
  };

  const checkProfile = async (session: any) => {
    console.log('🔍 Fetching profile for user:', session.user.id);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('❌ Profile fetch error:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
    }

    console.log('📋 Profile data:', profile);
    return profile;
  };

  const navigate = (profile: any) => {
    if (!profile) {
      console.log('📝 No profile - redirecting to complete profile');
      router.replace('/auth/complete-profile');
      return;
    }

    console.log('🚀 Navigating to dashboard:', profile.user_type);

    switch (profile.user_type) {
      case 'super-admin':
        router.replace('/super-admin');
        break;
      case 'admin':
        router.replace('/admin/users');
        break;
      case 'farmer':
      case 'buyer':
      default:
        router.replace('/');
        break;
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#059669" />
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9f4',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
  },
});
