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

        // Get the stored user type from sessionManager first, then fallback to legacy storage
        console.log('📱 Checking storage for OAuth state...');
        const { sessionManager } = await import('../../services/sessionManager');
        const oauthState = await sessionManager.getOAuthState();

        let storedUserType = oauthState?.userType;
        let oauthIntent = oauthState?.intent;

        console.log('📱 SessionManager OAuth state:', oauthState);

        // Fallback to legacy storage if sessionManager doesn't have the data
        if (!storedUserType || !oauthIntent) {
          console.log('📱 Falling back to legacy storage...');
          storedUserType = storedUserType || await AsyncStorage.getItem('oauth_user_type');
          oauthIntent = oauthIntent || await AsyncStorage.getItem('oauth_intent');

          // If not in AsyncStorage, try localStorage (for web)
          if (!storedUserType && typeof window !== 'undefined') {
            storedUserType = localStorage.getItem('oauth_user_type');
            console.log('📱 Checking localStorage for user type:', storedUserType);
          }

          if (!oauthIntent && typeof window !== 'undefined') {
            oauthIntent = localStorage.getItem('oauth_intent');
          }
        }

        console.log('📱 Final stored user type:', storedUserType);
        console.log('📱 OAuth intent:', oauthIntent);

        // Debug: Log all localStorage OAuth-related keys
        if (typeof window !== 'undefined') {
          console.log('🔍 All localStorage OAuth keys:');
          console.log('  - oauth_user_type:', localStorage.getItem('oauth_user_type'));
          console.log('  - oauth_intent:', localStorage.getItem('oauth_intent'));
          console.log('  - oauth_timestamp:', localStorage.getItem('oauth_timestamp'));
        }

        // For sign-in attempts or when intent is unclear, always look up user type from database
        // This fixes mobile browser issues where intent might not be properly stored
        if (oauthIntent === 'signin' || !oauthIntent) {
          console.log('📱 This is a sign-in attempt or unclear intent - looking up user type from database');
          console.log('📱 Mobile browser compatibility mode enabled');

          // First get the OAuth user to check their email
          console.log('🔐 Getting OAuth user...');
          const { data: { user: oauthUser }, error: userError } = await supabase.auth.getUser();

          console.log('🔐 OAuth user result:', {
            hasUser: !!oauthUser,
            email: oauthUser?.email,
            id: oauthUser?.id,
            error: userError
          });

          if (userError) {
            console.error('❌ Error getting OAuth user:', userError);
            router.replace('/auth/register?error=' + encodeURIComponent('Failed to get user information. Please try again.'));
            return;
          }

          if (oauthUser && oauthUser.email) {
            console.log('🔍 OAuth user found with email:', oauthUser.email);
            console.log('🔍 Checking database for existing profile...');

            try {
              // First, test database connection with a simple query
              console.log('🧪 Testing database connection...');
              const { data: testData, error: testError } = await supabase
                .from('profiles')
                .select('count')
                .limit(1);

              console.log('🧪 Database connection test:', { testData, testError });

              // Direct database query to check for existing profile
              console.log('🔍 Executing profile query for email:', oauthUser.email);
              const { data: existingProfile, error: profileError } = await supabase
                .from('profiles')
                .select('user_type, email, id, first_name, last_name')
                .eq('email', oauthUser.email)
                .single();

              console.log('🔍 Profile query result:', { existingProfile, profileError });
              console.log('🔍 Profile data details:', existingProfile);
              console.log('🔍 Looking for email:', oauthUser.email);

              // Also try a broader search to see if there are any profiles
              console.log('🔍 Checking if any profiles exist...');
              const { data: allProfiles, error: allError } = await supabase
                .from('profiles')
                .select('email, user_type')
                .limit(5);

              console.log('🔍 Sample profiles in database:', { allProfiles, allError });

              if (existingProfile && (existingProfile as any).user_type) {
                console.log('✅ Found existing profile for sign-in with user type:', (existingProfile as any).user_type);
                storedUserType = (existingProfile as any).user_type;

                // Store it for future reference (but don't rely on it)
                await AsyncStorage.setItem('oauth_user_type', (existingProfile as any).user_type);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('oauth_user_type', (existingProfile as any).user_type);
                  localStorage.setItem('oauth_timestamp', Date.now().toString());
                }

                // Clean up the intent flag
                await AsyncStorage.removeItem('oauth_intent');
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('oauth_intent');
                }

                console.log('✅ Sign-in user type resolved from database:', storedUserType);
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
              // Clean up and redirect to register
              await AsyncStorage.removeItem('oauth_intent');
              if (typeof window !== 'undefined') {
                localStorage.removeItem('oauth_intent');
              }
              router.replace('/auth/register?error=' + encodeURIComponent('Error checking account. Please try again.'));
              return;
            }
          } else {
            console.log('❌ No OAuth user email found');
            // Clean up and redirect
            await AsyncStorage.removeItem('oauth_intent');
            if (typeof window !== 'undefined') {
              localStorage.removeItem('oauth_intent');
            }
            router.replace('/auth/register?error=' + encodeURIComponent('Could not get email from Google. Please try again.'));
            return;
          }
        }

        // Handle cases where there's no stored user type for non-signin attempts
        if (!storedUserType && oauthIntent !== 'signin') {
          console.log('📱 No stored user type and not a sign-in intent - treating as registration attempt');
          // This handles the case where someone might access the callback directly
          // without going through proper registration or sign-in flow
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
                barangay: existingProfile.barangay,
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

          // Clean up OAuth state using sessionManager
          await sessionManager.clearOAuthState();

          // Also clean up legacy storage
          await AsyncStorage.removeItem('oauth_user_type');
          await AsyncStorage.removeItem('oauth_intent');

          // Also clean up localStorage completely
          if (typeof window !== 'undefined') {
            localStorage.removeItem('oauth_user_type');
            localStorage.removeItem('oauth_intent');
            localStorage.removeItem('oauth_timestamp');
          }

          // For existing users, always redirect to dashboard regardless of intent
          // This fixes the mobile browser issue where intent might be misidentified
          console.log('✅ Existing user found, redirecting to dashboard');
          const profile = existingProfile as any;
          console.log('👤 User type from profile:', profile.user_type);

          // If the user was trying to register but already has an account,
          // log it but still proceed with login
          if (oauthIntent === 'registration') {
            console.log('ℹ️ User attempted to register but account exists - proceeding with login');
          }

          switch (profile.user_type) {
            case 'farmer':
              console.log('🚜 Redirecting to farmer dashboard');
              router.replace('/farmer/my-products');
              break;
            case 'buyer':
              console.log('🛒 Redirecting to buyer marketplace');
              router.replace('/buyer/marketplace');
              break;
            case 'admin':
              console.log('👑 Redirecting to admin dashboard');
              router.replace('/admin/users');
              break;
            case 'super-admin':
              console.log('🔱 Redirecting to super admin dashboard');
              router.replace('/super-admin');
              break;
            default:
              console.log('❓ Unknown user type, defaulting to buyer marketplace');
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