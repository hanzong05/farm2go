import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile, loginUser, signInWithGoogle } from '../../services/auth';

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;
const isTablet = width >= 768 && width < 1024;
const isDesktop = width >= 1024;

// Farm2Go color scheme
const colors = {
  primary: '#059669',
  secondary: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  black: '#000000',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  green50: '#f0f9f4',
  green100: '#d1fae5',
  green200: '#a7f3d0',
  green500: '#10b981',
  green600: '#059669',
  green700: '#047857',
  background: '#f0f9f4',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
};

export default function LoginScreen() {
  const { info, error } = useLocalSearchParams();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Handle URL parameters for info messages
  useEffect(() => {
    if (info && typeof info === 'string') {
      setInfoMessage(info);
      setShowInfoModal(true);
    } else if (error && typeof error === 'string') {
      Alert.alert('Notice', error);
    }
  }, [info, error]);

  // Clear any stale OAuth state when login page loads
  useEffect(() => {
    console.log('🧹 OAuth state cleanup disabled for debugging');
    // Temporarily disabled to prevent localStorage errors
    // const clearStaleOAuthState = () => {
    //   const timestamp = safeLocalStorage.getItem('oauth_timestamp');
    //   if (timestamp) {
    //     const storedTime = parseInt(timestamp);
    //     const currentTime = Date.now();
    //     const tenMinutesAgo = currentTime - (10 * 60 * 1000);

    //     if (storedTime < tenMinutesAgo) {
    //       console.log('🧹 Clearing stale OAuth state from storage');
    //       safeLocalStorage.removeItem('oauth_user_type');
    //       safeLocalStorage.removeItem('oauth_intent');
    //       safeLocalStorage.removeItem('oauth_timestamp');
    //     }
    //   }
    // };

    // clearStaleOAuthState();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const { user } = await loginUser(formData);

      if (user) {
        // Get user profile to determine user type
        const userData = await getUserWithProfile();

        console.log('Login Debug - User Data:', userData);
        console.log('Login Debug - Profile:', userData?.profile);
        console.log('Login Debug - User Type:', userData?.profile?.user_type);

        if (userData?.profile) {
          console.log('✅ Profile found, user_type:', userData.profile.user_type);

          // Redirect based on user type
          switch (userData.profile.user_type) {
            case 'super-admin':
              console.log('🚀 Redirecting to super-admin dashboard');
              router.replace('/super-admin' as any);
              break;
            case 'admin':
              console.log('🚀 Redirecting to admin dashboard');
              try {
                router.replace('/admin/users' as any);
                console.log('✅ Admin redirect successful');
              } catch (error) {
                console.error('❌ Admin redirect failed:', error);
              }
              break;
            case 'farmer':
              console.log('🚀 Redirecting to marketplace');
              router.replace('/');
              break;
            case 'buyer':
              console.log('🚀 Redirecting to marketplace');
              router.replace('/');
              break;
            default:
              console.log('⚠️ Unknown user type, redirecting to marketplace. User type:', userData.profile.user_type);
              router.replace('/');
          }
        } else {
          console.log('❌ No profile found, redirecting to buyer marketplace');
          // Fallback to marketplace if profile not found
          router.replace('/');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        error.message || 'Please check your credentials and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('🔥 handleGoogleSignIn function called!');
    setIsLoading(true);

    try {
      console.log('🔥 About to call signInWithGoogle...');

      // Store OAuth intent for callback processing
      const { sessionManager } = await import('../../services/sessionManager');
      await sessionManager.storeOAuthState({
        intent: 'signin',
        userType: null, // Will be determined by callback page
        timestamp: Date.now()
      });

      const result = await signInWithGoogle(false) as any;
      console.log('🔄 OAuth result:', result);

      // Check if OAuth failed completely (not just dismissed)
      if (result && result.success === false && result.error !== 'OAuth was cancelled by user') {
        console.log('❌ OAuth failed:', result.error);
        setIsLoading(false);
        Alert.alert('Sign In Failed', result.error || 'Google sign-in failed. Please try again.');
        return;
      }

      // Check if OAuth was cancelled by user
      if (result && result.success === false && result.error === 'OAuth was cancelled by user') {
        console.log('ℹ️ OAuth cancelled by user');
        setIsLoading(false);
        return; // Don't show error, user cancelled intentionally
      }

      // For mobile/native platforms, let the callback handle everything
      // This prevents conflicts between login page and callback page navigation
      if (Platform.OS !== 'web') {
        console.log('📱 Mobile platform detected - waiting for deep link callback processing');
        // For mobile, the deep link will redirect to /auth/callback which will handle the rest
        // Keep loading state until auth state changes or callback redirects
        return;
      }

      // For web, handle immediate session if available
      if (result && result.sessionData && result.sessionData.user) {
        console.log('✅ OAuth completed with session data on web');

        // Clear OAuth state since we're handling it directly
        await sessionManager.clearOAuthState();

        // Let the layout handle the redirect to avoid conflicts
        setIsLoading(false);
        return;
      }

      // For web without immediate session data, wait for callback
      console.log('ℹ️ No direct session data on web, waiting for callback...');

    } catch (error: any) {
      console.error('🔥 Error in handleGoogleSignIn:', error);
      Alert.alert('Error', error.message || 'OAuth failed');
      setIsLoading(false);
    }
  };

  // Listen for auth state changes to handle successful OAuth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Login page auth state change:', event, session?.user?.id);

      // Handle SIGNED_OUT events
      if (event === 'SIGNED_OUT') {
        console.log('🔄 User signed out, resetting loading state');
        setIsLoading(false);
      }

      // Handle SIGNED_IN events during OAuth
      if (event === 'SIGNED_IN' && session?.user && isLoading) {
        console.log('✅ Auth state change: User signed in during OAuth');

        // Clear loading state immediately to prevent getting stuck
        setIsLoading(false);

        // Let the layout handle navigation - don't compete with callback page
        console.log('✅ Clearing loading state and letting layout handle navigation');
      }
    });

    return () => subscription.unsubscribe();
  }, [isLoading]);

  // Auth state changes are now handled by the callback page for OAuth flows
  // Regular email/password login still works through handleLogin above

  const renderFormInput = (
    field: string,
    label: string,
    placeholder: string,
    iconName: string,
    options: {
      keyboardType?: any;
      secureTextEntry?: boolean;
      autoCapitalize?: any;
    } = {}
  ) => {
    const isFocused = focusedInput === field;
    const hasValue = formData[field as keyof typeof formData];
    const isPasswordField = field === 'password';

    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>{label}</Text>
        <View style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          hasValue && styles.inputWrapperFilled
        ]}>
          <Icon 
            name={iconName} 
            size={18} 
            color={isFocused ? colors.primary : colors.gray400} 
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            value={formData[field as keyof typeof formData]}
            onChangeText={(value) => handleInputChange(field, value)}
            placeholder={placeholder}
            placeholderTextColor={colors.gray400}
            onFocus={() => setFocusedInput(field)}
            onBlur={() => setFocusedInput(null)}
            editable={!isLoading}
            secureTextEntry={isPasswordField ? !showPassword : options.secureTextEntry}
            {...options}
          />
          {isPasswordField && (
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggle}
            >
              <Icon 
                name={showPassword ? 'eye-slash' : 'eye'} 
                size={16} 
                color={colors.gray400} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderInfoModal = () => (
    <Modal
      visible={showInfoModal}
      transparent={true}
      animationKeyframesType="fade"
      onRequestClose={() => setShowInfoModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.infoIconContainer}>
            <Icon name="info-circle" size={32} color={colors.white} />
          </View>
          <Text style={styles.modalTitle}>Account Already Exists</Text>
          <Text style={styles.modalMessage}>
            {infoMessage}
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => setShowInfoModal(false)}
          >
            <Text style={styles.modalButtonText}>Continue to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* Background Pattern */}
        <View style={styles.backgroundPattern}>
          <View style={[styles.patternCircle, styles.circle1]} />
          <View style={[styles.patternCircle, styles.circle2]} />
          <View style={[styles.patternCircle, styles.circle3]} />
        </View>

        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>F2G</Text>
            </View>
            <Text style={styles.brandName}>Farm2Go</Text>
          </View>
          
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to continue your agricultural journey
            </Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.contentContainer}>
          <View style={styles.formCard}>
            {/* Form Section */}
            <View style={styles.formSection}>
              {renderFormInput(
                'email', 
                'Email Address', 
                'Enter your email address', 
                'envelope',
                {
                  keyboardType: 'email-address',
                  autoCapitalize: 'none'
                }
              )}

              {renderFormInput(
                'password', 
                'Password', 
                'Enter your password', 
                'lock',
                {
                  secureTextEntry: true
                }
              )}

              <TouchableOpacity style={styles.forgotPassword}>
                <Link href="/auth/forgot-password">
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </Link>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <View style={styles.loadingSpinner} />
                    <Text style={styles.loginButtonText}>Signing In...</Text>
                  </View>
                ) : (
                  <>
                    <Icon name="sign-in-alt" size={16} color={colors.white} style={styles.buttonIcon} />
                    <Text style={styles.loginButtonText}>Sign In</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerTextContainer}>
                  <Text style={styles.dividerText}>or</Text>
                </View>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign In Button */}
              <TouchableOpacity
                style={[styles.socialButton, isLoading && styles.socialButtonDisabled]}
                onPress={() => {
                  console.log('🔥 GOOGLE BUTTON PRESSED!');
                  handleGoogleSignIn();
                }}
                disabled={isLoading}
              >
                <View style={styles.googleIcon}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </TouchableOpacity>
            </View>

            {/* Register Link */}
            <View style={styles.registerSection}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <Link href="/auth/register">
                <Text style={styles.registerLink}>Sign Up</Text>
              </Link>
            </View>
          </View>

          {/* Features Section */}
          <View style={styles.featuresSection}>
            <View style={styles.featureItem}>
              <Icon name="seedling" size={20} color={colors.primary} />
              <Text style={styles.featureText}>Connect with local farmers</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="handshake" size={20} color={colors.primary} />
              <Text style={styles.featureText}>Direct trade opportunities</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="chart-line" size={20} color={colors.primary} />
              <Text style={styles.featureText}>Track your agricultural progress</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      {renderInfoModal()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    flexGrow: 1,
    minHeight: height,
  },

  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.6,
    overflow: 'hidden',
  },

  patternCircle: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: colors.green100,
    opacity: 0.3,
  },

  circle1: {
    width: 200,
    height: 200,
    top: -100,
    right: -50,
  },

  circle2: {
    width: 150,
    height: 150,
    top: 100,
    left: -75,
  },

  circle3: {
    width: 120,
    height: 120,
    top: 250,
    right: isMobile ? -20 : 100,
  },

  headerContainer: {
    paddingTop: Platform.OS === 'web' ? (isMobile ? 60 : 80) : (isMobile ? 80 : 100),
    paddingHorizontal: isMobile ? 24 : isTablet ? 32 : 40,
    paddingBottom: isMobile ? 40 : 60,
    alignItems: 'center',
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: isMobile ? 32 : 40,
  },

  logo: {
    width: isMobile ? 64 : 80,
    height: isMobile ? 64 : 80,
    borderRadius: isMobile ? 16 : 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
      },
      default: {
        elevation: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },

  logoText: {
    fontSize: isMobile ? 24 : 32,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: -1,
  },

  brandName: {
    fontSize: isMobile ? 28 : 36,
    fontWeight: '700',
    color: colors.gray800,
    letterSpacing: -0.5,
  },

  welcomeSection: {
    alignItems: 'center',
  },

  welcomeTitle: {
    fontSize: isMobile ? 24 : 32,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 8,
    textAlign: 'center',
  },

  welcomeSubtitle: {
    fontSize: isMobile ? 16 : 18,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: isMobile ? 24 : 28,
    maxWidth: isMobile ? width * 0.8 : 400,
  },

  contentContainer: {
    flex: 1,
    paddingHorizontal: isMobile ? 24 : isTablet ? 32 : 40,
    paddingBottom: 32,
    alignItems: 'center',
  },

  formCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: isMobile ? 24 : 32,
    width: '100%',
    maxWidth: isMobile ? undefined : 480,
    marginBottom: 32,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 10,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
    }),
  },

  formSection: {
    marginBottom: 24,
  },

  inputContainer: {
    marginBottom: 20,
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: 8,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gray200,
    borderRadius: 12,
    backgroundColor: colors.gray50,
    paddingHorizontal: 16,
    minHeight: 52,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease-in-out',
      },
    }),
  },

  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.1)',
      },
    }),
  },

  inputWrapperFilled: {
    borderColor: colors.gray300,
    backgroundColor: colors.white,
  },

  inputIcon: {
    marginRight: 12,
    width: 18,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: colors.gray800,
    paddingVertical: 16,
  },

  passwordToggle: {
    padding: 8,
  },

  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    padding: 4,
  },

  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    minHeight: 52,
    flexDirection: 'row',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease-in-out',
        boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
      },
      default: {
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },

  loginButtonDisabled: {
    backgroundColor: colors.gray400,
    ...Platform.select({
      web: {
        boxShadow: 'none',
      },
      default: {
        elevation: 0,
      },
    }),
  },

  loginButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  buttonIcon: {
    marginRight: 8,
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  loadingSpinner: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: colors.white,
    borderTopColor: 'transparent',
    borderRadius: 8,
    marginRight: 8,
    ...Platform.select({
      web: {
        animationKeyframes: 'spin 1s linear infinite',
      },
    }),
  },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray200,
  },

  dividerTextContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
  },

  dividerText: {
    fontSize: 14,
    color: colors.gray500,
    fontWeight: '500',
  },

  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    minHeight: 52,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease-in-out',
      },
    }),
  },

  socialButtonDisabled: {
    opacity: 0.6,
  },

  googleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#db4437',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  googleIconText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.white,
  },

  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray700,
  },

  registerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },

  registerText: {
    fontSize: 15,
    color: colors.gray600,
  },

  registerLink: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },

  featuresSection: {
    width: '100%',
    maxWidth: isMobile ? undefined : 480,
    gap: 16,
  },

  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
      default: {
        elevation: 2,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
    }),
  },

  featureText: {
    fontSize: 14,
    color: colors.gray600,
    marginLeft: 12,
    fontWeight: '500',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      },
      default: {
        elevation: 20,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
    }),
  },

  infoIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 16,
    textAlign: 'center',
  },

  modalMessage: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },

  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
  },

  modalButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});