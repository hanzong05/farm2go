import { Link, router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { getUserWithProfile, loginUser, signInWithGoogle } from '../../services/auth';
import { supabase } from '../../lib/supabase';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

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

        if (userData?.profile) {
          // Redirect based on user type
          switch (userData.profile.user_type) {
            case 'admin':
              router.replace('/admin/users');
              break;
            case 'farmer':
              router.replace('/farmer/my-products');
              break;
            case 'buyer':
              router.replace('/buyer/marketplace');
              break;
            default:
              router.replace('/buyer/marketplace');
          }
        } else {
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
      await signInWithGoogle();

      // OAuth will redirect, so this code won't execute immediately
      console.log('🔄 Google OAuth initiated...');

    } catch (error: any) {
      console.error('Google sign in error:', error);
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
          // Redirect based on user type
          switch (userData.profile.user_type) {
            case 'admin':
              router.replace('/admin/users');
              break;
            case 'farmer':
              router.replace('/farmer/my-products');
              break;
            case 'buyer':
              router.replace('/buyer/marketplace');
              break;
            default:
              router.replace('/buyer/marketplace');
          }
        } else {
          console.log('⚠️ No profile found, redirecting to marketplace');
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
              <Text style={styles.registerText}>Don't have an account? </Text>
              <Link href="/auth/register">
                <Text style={styles.registerLink}>Sign Up</Text>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
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
});