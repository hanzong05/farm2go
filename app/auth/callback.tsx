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

        // Clear any stale localStorage state first (Chrome desktop fix)
        if (typeof window !== 'undefined') {
          console.log('🧹 Clearing any stale localStorage state...');
          // Check if we have stale data from previous sessions
          const storedTimestamp = localStorage.getItem('oauth_timestamp');
          const currentTime = Date.now();
          const fiveMinutesAgo = currentTime - (5 * 60 * 1000);

          if (storedTimestamp && parseInt(storedTimestamp) < fiveMinutesAgo) {
            console.log('🧹 Found stale localStorage data, clearing...');
            localStorage.removeItem('oauth_user_type');
            localStorage.removeItem('oauth_intent');
            localStorage.removeItem('oauth_timestamp');
          }

          console.log('🌐 Platform info:', {
            userAgent: navigator.userAgent,
            url: window.location.href,
            hash: window.location.hash
          });
        }

        // Get the stored user type from AsyncStorage and localStorage (for web compatibility)
        console.log('📱 Checking storage for user type...');
        let storedUserType = await AsyncStorage.getItem('oauth_user_type');

        // Check if this is a sign-in intent
        let oauthIntent = await AsyncStorage.getItem('oauth_intent');

        // If not in AsyncStorage, try localStorage (for web)
        if (!storedUserType && typeof window !== 'undefined') {
          storedUserType = localStorage.getItem('oauth_user_type');
          console.log('📱 Checking localStorage for user type:', storedUserType);
        }

        if (!oauthIntent && typeof window !== 'undefined') {
          oauthIntent = localStorage.getItem('oauth_intent');
        }

        console.log('📱 Final stored user type:', storedUserType);
        console.log('📱 OAuth intent:', oauthIntent);

        // Handle cases where there's no stored user type
        if (!storedUserType) {
          // Check if this is a sign-in intent
          if (oauthIntent === 'signin') {
            console.log('📱 This is a sign-in attempt');

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
                  console.log('✅ Found existing profile for sign-in with user type:', (existingProfile as any).user_type);
                  storedUserType = (existingProfile as any).user_type;

                  // Store it for future reference
                  await AsyncStorage.setItem('oauth_user_type', (existingProfile as any).user_type);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('oauth_user_type', (existingProfile as any).user_type);
                  }

                  // Clean up the intent flag
                  await AsyncStorage.removeItem('oauth_intent');
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('oauth_intent');
                  }
                } else {
                  console.log('ℹ️ No existing profile found for email:', oauthUser.email);
                  console.log('⚠️ User trying to sign in with Google but no account exists');

                  // Clean up the intent flag
                  await AsyncStorage.removeItem('oauth_intent');
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('oauth_intent');
                  }

                  // Redirect to register page with error message
                  router.replace('/auth/register?error=' + encodeURIComponent('No account found with this email. Please register first or use a different sign-in method.'));
                  return;
                }
              } catch (error) {
                console.error('❌ Error checking for existing profile:', error);
              }
            }
          } else {
            console.log('📱 No stored user type and no sign-in intent - treating as registration attempt');
            // This handles the case where someone might access the callback directly
            // without going through proper registration or sign-in flow
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

        // Check if profile already exists by ID first
        console.log('🔍 Checking for existing profile by user ID...');
        const { data: existingProfileById, error: profileByIdError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('🔍 Existing profile by ID:', existingProfileById);
        console.log('🔍 Profile by ID check error:', profileByIdError);

        let existingProfile = existingProfileById;

        // If no profile found by ID, check by email (for OAuth users with existing accounts)
        if (!existingProfile && user.email) {
          console.log('🔍 No profile found by ID, checking by email for existing user...');
          const { data: existingProfileByEmail, error: profileByEmailError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', user.email)
            .single();

          console.log('🔍 Existing profile by email:', existingProfileByEmail);
          console.log('🔍 Profile by email check error:', profileByEmailError);

          if (existingProfileByEmail) {
            existingProfile = existingProfileByEmail;
            console.log('✅ Found existing profile by email - this is an existing user signing in with OAuth');
          }
        }

        if (existingProfile) {
          console.log('✅ Profile already exists');

          // If profile was found by email but has different ID, we need to create a new profile entry for the OAuth user
          if (existingProfile.id !== user.id) {
            console.log('🔄 Profile found by email but different ID - creating OAuth profile entry');
            console.log('📝 Original profile ID:', existingProfile.id, 'OAuth user ID:', user.id);

            try {
              // Create a new profile entry for the OAuth user with the same data
              const oauthProfileData = {
                id: user.id,
                email: existingProfile.email,
                phone: existingProfile.phone,
                first_name: existingProfile.first_name,
                middle_name: existingProfile.middle_name,
                last_name: existingProfile.last_name,
                barangay: existingProfile.barangay,
                user_type: existingProfile.user_type,
                farm_name: existingProfile.farm_name,
                farm_location: existingProfile.farm_location,
                farm_size: existingProfile.farm_size,
                crop_types: existingProfile.crop_types,
                company_name: existingProfile.company_name,
                business_type: existingProfile.business_type,
                business_location: existingProfile.business_location,
              };

              const { error: insertError } = await supabase
                .from('profiles')
                .insert(oauthProfileData);

              if (insertError) {
                console.error('❌ Error creating OAuth profile:', insertError);
                console.log('⚠️ OAuth profile creation failed, but continuing with existing profile data');
              } else {
                console.log('✅ OAuth profile created successfully');
                // Update the existingProfile object to reflect the new OAuth profile
                existingProfile = { ...existingProfile, id: user.id };
              }
            } catch (insertError) {
              console.error('❌ Exception creating OAuth profile:', insertError);
              // Continue with existing profile anyway
            }
          }

          // Clean up storage
          await AsyncStorage.removeItem('oauth_user_type');
          await AsyncStorage.removeItem('oauth_intent');

          // Also clean up localStorage completely
          if (typeof window !== 'undefined') {
            localStorage.removeItem('oauth_user_type');
            localStorage.removeItem('oauth_intent');
            localStorage.removeItem('oauth_timestamp');
          }

          // Check if this was a registration attempt
          if (storedUserType && oauthIntent === 'registration') {
            console.log('⚠️ User attempted to register with Gmail but account already exists');
            console.log('🔄 Redirecting to login with message...');

            const errorMessage = `An account with this email (${user.email}) already exists. Please sign in instead.`;
            router.replace(`/auth/login?info=${encodeURIComponent(errorMessage)}`);
            return;
          } else {
            // Regular sign-in flow or existing user
            console.log('✅ Sign-in successful, redirecting to dashboard');
            const profile = existingProfile as any;
            console.log('👤 User type from profile:', profile.user_type);

            switch (profile.user_type) {
              case 'farmer':
                console.log('🚜 Redirecting to farmer dashboard');
                router.replace('/farmer/my-products');
                break;
              case 'buyer':
                console.log('🛒 Redirecting to buyer marketplace');
                router.replace('/buyer/marketplace');
                break;
              default:
                console.log('❓ Unknown user type, defaulting to buyer marketplace');
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

        // Clean up stored user type and intent
        await AsyncStorage.removeItem('oauth_user_type');
        await AsyncStorage.removeItem('oauth_intent');

        // Also clean up localStorage completely
        if (typeof window !== 'undefined') {
          localStorage.removeItem('oauth_user_type');
          localStorage.removeItem('oauth_intent');
          localStorage.removeItem('oauth_timestamp');
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