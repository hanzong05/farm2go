import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, ScrollView, Platform, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserWithProfile, loginUser, signInWithGoogle } from '../../services/auth';
import { supabase } from '../../lib/supabase';

const { width, height } = Dimensions.get('window');

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
    if (typeof window !== 'undefined') {
      const clearStaleOAuthState = () => {
        const timestamp = localStorage.getItem('oauth_timestamp');
        if (timestamp) {
          const storedTime = parseInt(timestamp);
          const currentTime = Date.now();
          const tenMinutesAgo = currentTime - (10 * 60 * 1000);

          if (storedTime < tenMinutesAgo) {
            console.log('🧹 Clearing stale OAuth state from localStorage');
            localStorage.removeItem('oauth_user_type');
            localStorage.removeItem('oauth_intent');
            localStorage.removeItem('oauth_timestamp');
          }
        }
      };

      clearStaleOAuthState();
    }
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
              router.replace('/super-admin');
              break;
            case 'admin':
              console.log('🚀 Redirecting to admin dashboard');
              router.replace('/admin/users');
              break;
            case 'farmer':
              console.log('🚀 Redirecting to farmer dashboard');
              router.replace('/farmer');
              break;
            case 'buyer':
              console.log('🚀 Redirecting to buyer dashboard');
              router.replace('/buyer/marketplace');
              break;
            default:
              console.log('⚠️ Unknown user type, redirecting to marketplace. User type:', userData.profile.user_type);
              router.replace('/buyer/marketplace');
          }
        } else {
          console.log('❌ No profile found, redirecting to buyer marketplace');
          // Fallback to buyer dashboard if profile not found
          router.replace('/buyer/marketplace');
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
    setIsLoading(true);

    try {
      console.log('🚀 Starting Google sign in...');

      // Store OAuth state using session manager
      const { sessionManager } = await import('../../services/sessionManager');
      await sessionManager.storeOAuthState({
        intent: 'signin',
        userType: null,
        source: 'login_page'
      });

      await signInWithGoogle(false); // false indicates this is not registration

      // OAuth will redirect, so this code won't execute immediately
      console.log('🔄 Google OAuth initiated...');

    } catch (error: any) {
      console.error('Google sign in error:', error);

      // Clean up OAuth state on error
      const { sessionManager } = await import('../../services/sessionManager');
      await sessionManager.clearOAuthState();

      Alert.alert(
        'Google Sign In Failed',
        error.message || 'Please try again.'
      );
      setIsLoading(false);
    }
  };

  // Listen for authentication state changes - React Native compatible
  useEffect(() => {
    console.log('🔍 Setting up React Native auth listener for login...');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change on login:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ User signed in:', session.user.email);
        setIsLoading(false);

        // Get user profile to determine redirect
        const userData = await getUserWithProfile();

        if (userData?.profile) {
          console.log('✅ Auth state change - Profile found, user_type:', userData.profile.user_type);

          // Redirect based on user type
          switch (userData.profile.user_type) {
            case 'super-admin':
              console.log('🚀 Auth state change - Redirecting super admin to dashboard');
              router.replace('/super-admin');
              break;
            case 'admin':
              console.log('🚀 Auth state change - Redirecting admin to dashboard');
              router.replace('/admin/users');
              break;
            case 'farmer':
              console.log('🚀 Auth state change - Redirecting farmer to dashboard');
              router.replace('/farmer');
              break;
            case 'buyer':
              console.log('🚀 Auth state change - Redirecting buyer to marketplace');
              router.replace('/buyer/marketplace');
              break;
            default:
              console.log('⚠️ Auth state change - Unknown user type, redirecting to marketplace. User type:', userData.profile.user_type);
              router.replace('/buyer/marketplace');
          }
        } else {
          console.log('❌ Auth state change - No profile found, redirecting to marketplace');
          router.replace('/buyer/marketplace');
        }
      }
    });

    return () => {
      console.log('🧹 Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const renderFormInput = (
    field: string,
    label: string,
    placeholder: string,
    options: {
      keyboardType?: any;
      secureTextEntry?: boolean;
      autoCapitalize?: any;
    } = {}
  ) => {
    const isFocused = focusedInput === field;
    const hasValue = formData[field as keyof typeof formData];

    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>{label}</Text>
        <View style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          hasValue && styles.inputWrapperFilled
        ]}>
          <TextInput
            style={styles.input}
            value={formData[field as keyof typeof formData]}
            onChangeText={(value) => handleInputChange(field, value)}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            onFocus={() => setFocusedInput(field)}
            onBlur={() => setFocusedInput(null)}
            editable={!isLoading}
            {...options}
          />
        </View>
      </View>
    );
  };

  const renderInfoModal = () => (
    <Modal
      visible={showInfoModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowInfoModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoMark}>ℹ</Text>
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
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <Text style={styles.brandName}>Farm2Go</Text>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in to your account and continue your agricultural journey
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.formSection}>
            {renderFormInput('email', 'Email Address', 'Enter your email address', {
              keyboardType: 'email-address',
              autoCapitalize: 'none'
            })}

            {renderFormInput('password', 'Password', 'Enter your password', {
              secureTextEntry: true
            })}

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
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In Button */}
            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              <Text style={[styles.socialButtonIcon, styles.googleIcon]}>G</Text>
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerSection}>
              <Text style={styles.registerText}>Don&apos;t have an account? </Text>
              <Link href="/auth/register">
                <Text style={styles.registerLink}>Sign Up</Text>
              </Link>
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
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: '#1f2937',
    paddingBottom: 30,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  brandName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#d1d5db',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: width * 0.8,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -15,
    paddingTop: 32,
    minHeight: height * 0.7,
  },
  formSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  inputWrapperFocused: {
    borderColor: '#10b981',
  },
  inputWrapperFilled: {
    borderColor: '#9ca3af',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    minHeight: 48,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    marginBottom: 24,
  },
  googleButton: {
    borderColor: '#db4437',
  },
  socialButtonIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 12,
    color: '#ffffff',
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 24,
    borderRadius: 12,
  },
  googleIcon: {
    backgroundColor: '#db4437',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  registerSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  registerText: {
    fontSize: 15,
    color: '#6b7280',
  },
  registerLink: {
    fontSize: 15,
    color: '#10b981',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  infoIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  infoMark: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  modalButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});