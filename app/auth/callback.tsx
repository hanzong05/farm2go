import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔄 OAuth callback screen loaded!');
        console.log('🔄 Processing OAuth callback...');

        // Get the stored user type from AsyncStorage and localStorage (for web compatibility)
        console.log('📱 Checking storage for user type...');
        let storedUserType = await AsyncStorage.getItem('oauth_user_type');

        // If not in AsyncStorage, try localStorage (for web)
        if (!storedUserType && typeof window !== 'undefined') {
          storedUserType = localStorage.getItem('oauth_user_type');
          console.log('📱 Checking localStorage for user type:', storedUserType);
        }

        console.log('📱 Final stored user type:', storedUserType);

        if (!storedUserType) {
          console.error('❌ No user type found in any storage');
          console.log('🔄 Redirecting to complete profile instead...');
          // Instead of error, redirect to complete profile and let user choose type there
          router.replace('/auth/complete-profile');
          return;
        }

        // Verify the OAuth user exists
        console.log('🔐 Checking for OAuth user...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('🔐 OAuth user data:', user);
        console.log('🔐 OAuth user error:', userError);

        if (userError || !user) {
          console.error('❌ No OAuth user found:', userError);
          throw new Error('OAuth authentication failed');
        }

        console.log('✅ OAuth user verified:', user.email);
        console.log('✅ OAuth user ID:', user.id);
        console.log('✅ OAuth user metadata:', user.user_metadata);

        // Check if profile already exists (in case of re-authentication)
        console.log('🔍 Checking for existing profile...');
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('🔍 Existing profile:', existingProfile);
        console.log('🔍 Profile check error:', profileError);

        if (existingProfile) {
          console.log('✅ Profile already exists, redirecting to appropriate dashboard');
          await AsyncStorage.removeItem('oauth_user_type');

          // Also clean up localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('oauth_user_type');
          }

          // Redirect based on user type instead of login
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
    // Add a small delay to ensure the OAuth process is complete
    const timer = setTimeout(handleCallback, 1000);

    return () => {
      console.log('🧹 Cleaning up callback timer');
      clearTimeout(timer);
    };
  }, []);

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