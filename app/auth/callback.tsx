import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const handleCallback = async () => {
      try {
        console.log('🔄 OAuth callback screen loaded!');
        console.log('🔄 Processing OAuth callback...');
        // Only log platform info on client side to avoid hydration issues
        if (typeof window !== 'undefined') {
          console.log('🌐 Platform info:', {
            userAgent: navigator.userAgent,
            url: window.location.href,
            hash: window.location.hash
          });
        }


        // Get the stored user type from AsyncStorage and localStorage (for web compatibility)
        console.log('📱 Checking storage for user type...');
        let storedUserType = await AsyncStorage.getItem('oauth_user_type');

        // If not in AsyncStorage, try localStorage (for web)
        if (!storedUserType && typeof window !== 'undefined') {
          storedUserType = localStorage.getItem('oauth_user_type');
          console.log('📱 Checking localStorage for user type:', storedUserType);
        }

        console.log('📱 Final stored user type:', storedUserType);

        // If no stored user type, this means it's a sign-in attempt, not registration
        if (!storedUserType) {
          console.log('📱 No stored user type - this appears to be a sign-in attempt, not registration');

          // First get the OAuth user to check their email
          const { data: { user: oauthUser }, error: userError } = await supabase.auth.getUser();

          if (oauthUser && oauthUser.email) {
            console.log('🔍 Checking database for existing profile with email:', oauthUser.email);

            try {
              // Direct database query to check for existing profile
              const { data: existingProfile, error: profileError } = await supabase
                .from('profiles')
                .select('user_type, email, id')
                .eq('email', oauthUser.email)
                .single();

              console.log('🔍 Profile query result:', { existingProfile, profileError });

              if (existingProfile && (existingProfile as any).user_type) {
                console.log('✅ Found existing profile with user type:', (existingProfile as any).user_type);
                storedUserType = (existingProfile as any).user_type;

                // Store it for future reference
                await AsyncStorage.setItem('oauth_user_type', (existingProfile as any).user_type);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('oauth_user_type', (existingProfile as any).user_type);
                }
              } else {
                console.log('ℹ️ No existing profile found for email:', oauthUser.email);
                console.log('⚠️ User trying to sign in with Google but no account exists');

                // Redirect to register page with error message
                router.replace('/auth/register?error=' + encodeURIComponent('No account found with this email. Please register first or use a different sign-in method.'));
                return;
              }
            } catch (error) {
              console.error('❌ Error checking for existing profile:', error);
            }
          }
        }

        if (!storedUserType) {
          console.error('❌ No user type found in storage or database');
          console.log('🔄 Redirecting to complete profile to let user choose...');
          router.replace('/auth/complete-profile');
          return;
        }

        // Verify the OAuth user exists
        console.log('🔐 Checking for OAuth user...');

        // Simple retry logic for desktop Chrome
        let user = null;
        let userError = null;
        let retryCount = 0;
        const maxRetries = 3;

        while (!user && retryCount < maxRetries) {
          const result = await supabase.auth.getUser();
          user = result.data.user;
          userError = result.error;

          if (!user && retryCount < maxRetries - 1) {
            console.log(`🔄 Retry ${retryCount + 1}/${maxRetries} - waiting 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          retryCount++;
        }

        console.log('🔐 OAuth user data:', user);
        console.log('🔐 OAuth user error:', userError);

        if (userError || !user) {
          console.error('❌ No OAuth user found after retries:', userError);
          throw new Error('OAuth authentication failed');
        }

        console.log('✅ OAuth user verified:', user.email);
        console.log('✅ OAuth user ID:', user.id);
        console.log('✅ OAuth user metadata:', user.user_metadata);

        // Check if profile already exists
        console.log('🔍 Checking for existing profile...');
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('🔍 Existing profile:', existingProfile);
        console.log('🔍 Profile check error:', profileError);

        if (existingProfile) {
          console.log('✅ Profile already exists');
          await AsyncStorage.removeItem('oauth_user_type');

          // Also clean up localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('oauth_user_type');
          }

          // Check if this was a registration attempt
          if (storedUserType) {
            console.log('⚠️ User attempted to register with Gmail but account already exists');
            console.log('🔄 Redirecting to login with message...');

            const errorMessage = `An account with this email (${user.email}) already exists. Please sign in instead.`;
            router.replace(`/auth/login?info=${encodeURIComponent(errorMessage)}`);
            return;
          } else {
            // Regular sign-in flow
            console.log('✅ Regular sign-in, redirecting to dashboard');
            const profile = existingProfile as any;
            switch (profile.user_type) {
              case 'farmer':
                router.replace('/farmer/my-products');
                break;
              case 'buyer':
                router.replace('/buyer/marketplace');
                break;
              default:
                router.replace('/buyer/marketplace');
            }
            return;
          }
        }

        // Redirect to complete profile screen
        console.log('🔄 No existing profile found');
        console.log('🔄 Redirecting to complete profile screen...');
        router.replace('/auth/complete-profile');

      } catch (error: any) {
        console.error('❌ OAuth callback error:', error);
        console.error('❌ Full error details:', JSON.stringify(error, null, 2));

        // Clean up stored user type
        await AsyncStorage.removeItem('oauth_user_type');

        // Also clean up localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('oauth_user_type');
        }

        // Redirect back to register with error
        console.log('🔄 Redirecting to register with error...');
        router.replace(`/auth/register?error=${encodeURIComponent(error.message || 'OAuth failed')}`);
      }
    };

    console.log('⏰ Setting callback timer...');
    // Add longer delay for desktop Chrome compatibility
    const timer = setTimeout(handleCallback, 2000);

    return () => {
      console.log('🧹 Cleaning up callback timer');
      clearTimeout(timer);
    };
  }, [isClient]);

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