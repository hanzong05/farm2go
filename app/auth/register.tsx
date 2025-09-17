import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LocationPicker from '../../components/LocationPicker';
import { supabase } from '../../lib/supabase';
import { registerUser, signInWithFacebook, signInWithGoogle } from '../../services/auth';
import { Database } from '../../types/database';

const { width, height } = Dimensions.get('window');

type UserType = 'farmer' | 'buyer' | null;

export default function RegisterScreen() {
  const [userType, setUserType] = useState<UserType>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorTitle, setErrorTitle] = useState('');
  useEffect(() => {
    console.log('🔍 Setting up React Native auth state listener...');
    console.log('🔍 Platform:', Platform.OS);

    let oauthPolling: any;
    let checkTimeout: any;

    const checkOAuthCompletion = async () => {
      try {
        const storedUserType = await AsyncStorage.getItem('oauth_user_type');

        if (storedUserType) {
          console.log('🔍 Found stored user type:', storedUserType);

          const { data: { user }, error } = await supabase.auth.getUser();

          if (user && !error) {
            console.log('✅ Found OAuth user:', user.email);

            const { data: existingProfile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();

            console.log('🔍 Existing profile check:', existingProfile);
            console.log('🔍 Profile error:', profileError);

            if (!existingProfile || profileError) {
              console.log('🚀 No profile found, redirecting to complete profile!');
              router.replace('/auth/complete-profile');
            } else {
              console.log('✅ Profile exists, redirecting to dashboard');
              await AsyncStorage.removeItem('oauth_user_type');

              const profile = existingProfile as Database['public']['Tables']['profiles']['Row'];
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
            }
            return true;
          } else {
            console.log('🔍 No user session found yet, but checking for existing profile by email...');

            // If we have stored user type but no session, try to find existing profile by email
            // This can happen when users sign in with Gmail after previously registering
            if (typeof window !== 'undefined') {
              // For web, we might have access to the email from URL or other sources
              const urlParams = new URLSearchParams(window.location.search);
              const emailFromUrl = urlParams.get('email');

              if (emailFromUrl) {
                console.log('🔍 Checking for existing profile with email from URL:', emailFromUrl);
                const { checkExistingUserProfile } = await import('../../services/auth');
                const existingProfile = await checkExistingUserProfile(emailFromUrl);

                if (existingProfile && existingProfile.user_type) {
                  console.log('✅ Found existing profile, updating stored user type');
                  await AsyncStorage.setItem('oauth_user_type', existingProfile.user_type);
                  localStorage.setItem('oauth_user_type', existingProfile.user_type);
                  // Continue with normal flow
                }
              }
            }
          }
        }
        return false; 
      } catch (error) {
        console.error('❌ OAuth check error:', error);
        return false;
      }
    };

 
    checkOAuthCompletion();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        console.log('🔄 Auth state change EVENT:', event);
        console.log('🔄 Auth state change SESSION:', !!session);
        console.log('🔄 Auth state change USER:', !!session?.user);

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User signed in via OAuth:', session.user.email);
          let storedUserType = await AsyncStorage.getItem('oauth_user_type');
          console.log('🔍 Stored user type:', storedUserType);

          // If no stored user type, check database for existing profile
          if (!storedUserType && session.user.email) {
            console.log('🔍 No stored user type, checking database for existing profile...');
            const { checkExistingUserProfile } = await import('../../services/auth');
            const existingProfile = await checkExistingUserProfile(session.user.email);

            if (existingProfile && existingProfile.user_type) {
              console.log('✅ Found existing profile with user type:', existingProfile.user_type);
              storedUserType = existingProfile.user_type;

              // Store it for future reference
              await AsyncStorage.setItem('oauth_user_type', existingProfile.user_type);
              if (typeof window !== 'undefined') {
                localStorage.setItem('oauth_user_type', existingProfile.user_type);
              }
            }
          }

          if (storedUserType) {
            console.log('🔄 OAuth signup detected, checking for existing profile...');
            const { data: existingProfile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            console.log('🔍 Existing profile:', existingProfile);
            console.log('🔍 Profile error:', profileError);

            if (!existingProfile || profileError) {
              console.log('🚀 No profile found, redirecting to complete profile!');
              router.replace('/auth/complete-profile');
            } else {
              console.log('✅ Profile exists, cleaning up and redirecting to dashboard');
              await AsyncStorage.removeItem('oauth_user_type');
              const profile = existingProfile as Database['public']['Tables']['profiles']['Row'];
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
            }
            return;
          }
        }
      } catch (error) {
        console.error('❌ Auth state change error:', error);
      }
    });


    oauthPolling = setInterval(async () => {
      const found = await checkOAuthCompletion();
      if (found) {
        console.log('🚀 OAuth completion detected, stopping polling');
        clearInterval(oauthPolling);
      }
    }, 1500); 
    checkTimeout = setTimeout(() => {
      console.log('🛑 OAuth check timeout reached, stopping polling');
      clearInterval(oauthPolling);
    }, 30000);

    return () => {
      console.log('🧹 Cleaning up React Native auth listeners');
      subscription.unsubscribe();
      if (oauthPolling) clearInterval(oauthPolling);
      if (checkTimeout) clearTimeout(checkTimeout);
    };
  }, []);
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    barangay: '',
    farmName: '',
    farmSize: '',
    cropTypes: '',
    companyName: '',
    businessType: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getPasswordStrength = (password: string) => {
    if (password.length < 4) return { strength: 'weak', color: '#dc2626', width: 0.25 };
    if (password.length < 8) return { strength: 'medium', color: '#d97706', width: 0.65 };
    return { strength: 'strong', color: '#059669', width: 1 };
  };

  const handleRegister = async () => {
    if (isRegistering || rateLimitCooldown > 0) {
      return;
    }

 
    if (!userType) {
      setErrorTitle('Selection Required');
      setErrorMessage('Please select your account type');
      setShowErrorModal(true);
      return;
    }

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.password || !formData.barangay) {
      setErrorTitle('Required Fields');
      setErrorMessage('Please fill in all required fields');
      setShowErrorModal(true);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorTitle('Password Mismatch');
      setErrorMessage('Passwords do not match');
      setShowErrorModal(true);
      return;
    }

    if (formData.password.length < 6) {
      setErrorTitle('Password Too Short');
      setErrorMessage('Password must be at least 6 characters long');
      setShowErrorModal(true);
      return;
    }
      
    if (userType === 'farmer') {
      if (!formData.farmName) {
        setErrorTitle('Required Fields');
        setErrorMessage('Please fill in all required farm information');
        setShowErrorModal(true);
        return;
      }
    }

    if (userType === 'buyer') {
      if (!formData.companyName) {
        setErrorTitle('Required Fields');
        setErrorMessage('Please fill in all required business information');
        setShowErrorModal(true);
        return;
      }
    }

    setIsRegistering(true);

    try {
      const registrationData = {
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        barangay: formData.barangay,
        userType,
        farmName: formData.farmName,
        farmSize: formData.farmSize,
        cropTypes: formData.cropTypes,
        companyName: formData.companyName,
        businessType: formData.businessType,
      };

      await registerUser(registrationData);
      setShowSuccessModal(true);

    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.message && error.message.includes('you can only request this after')) {
        const match = error.message.match(/after (\d+) seconds/);
        const seconds = match ? parseInt(match[1]) : 60;
        
        setRateLimitCooldown(seconds);
        
        const countdown = setInterval(() => {
          setRateLimitCooldown(prev => {
            if (prev <= 1) {
              clearInterval(countdown);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        setErrorTitle('Rate Limit Exceeded');
        setErrorMessage(`Please wait ${seconds} seconds before attempting registration again.`);
        setShowErrorModal(true);
      } else {
        let errorMessage = 'Please try again.';
        
        if (error.message) {
          if (error.message.includes('Email already registered') ||
              error.message.includes('User already registered') ||
              error.message.includes('duplicate key') ||
              error.code === '23505') {
            errorMessage = 'This phone number is already registered. Please sign in instead.';
          } else if (error.message.includes('Invalid phone')) {
            errorMessage = 'Please enter a valid phone number.';
          } else if (error.message.includes('Password')) {
            errorMessage = 'Password must be at least 6 characters long.';
          } else {
            errorMessage = error.message;
          }
        }
        
        setErrorTitle('Registration Failed');
        setErrorMessage(errorMessage);
        setShowErrorModal(true);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSocialSignup = async (provider: 'google' | 'facebook') => {
    if (!userType) {
      setErrorTitle('Selection Required');
      setErrorMessage('Please select your account type first');
      setShowErrorModal(true);
      return;
    }

    setIsRegistering(true);

    try {
      console.log(`🚀 Starting ${provider} registration...`);
      console.log('🚀 User type selected:', userType);

      // First, check if user already exists by initiating OAuth to get email
      console.log('🔄 Initiating OAuth to check for existing user...');

      if (provider === 'google') {
        // Store the user type for this registration attempt
        await AsyncStorage.setItem('oauth_user_type', userType);
        console.log('💾 Stored user type in AsyncStorage:', userType);

        const storedType = await AsyncStorage.getItem('oauth_user_type');
        console.log('✅ Verified stored type:', storedType);

        console.log('🔄 Initiating Google OAuth...');
        const result = await signInWithGoogle(true);
        console.log('📤 Google OAuth result:', result);
      } else {
        // Store the user type for this registration attempt
        await AsyncStorage.setItem('oauth_user_type', userType);
        console.log('💾 Stored user type in AsyncStorage:', userType);

        const storedType = await AsyncStorage.getItem('oauth_user_type');
        console.log('✅ Verified stored type:', storedType);

        console.log('🔄 Initiating Facebook OAuth...');
        const result = await signInWithFacebook();
        console.log('📤 Facebook OAuth result:', result);
      }

      console.log('🔄 OAuth initiated, user should be redirected to provider...');

    } catch (error: any) {
      console.error(`❌ ${provider} registration error:`, error);
      await AsyncStorage.removeItem('oauth_user_type');

      setErrorTitle(`${provider === 'google' ? 'Google' : 'Facebook'} Registration Failed`);
      setErrorMessage(error.message || 'Please try again.');
      setShowErrorModal(true);
      setIsRegistering(false);
    }
  };

  const renderSuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.successIcon}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <Text style={styles.modalTitle}>Registration Successful</Text>
          <Text style={styles.modalMessage}>
            Welcome to Farm2Go! Your account has been created successfully.
            You can now sign in and start using the platform.
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => {
              setShowSuccessModal(false);
              router.replace('/auth/login');
            }}
          >
            <Text style={styles.modalButtonText}>Continue to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderErrorModal = () => (
    <Modal
      visible={showErrorModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowErrorModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorMark}>✕</Text>
          </View>
          <Text style={styles.modalTitle}>{errorTitle}</Text>
          <Text style={styles.modalMessage}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={styles.errorModalButton}
            onPress={() => setShowErrorModal(false)}
          >
            <Text style={styles.modalButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderProgressBar = () => {
    const totalSteps = userType ? 2 : 1;
    const progress = currentStep / totalSteps;
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View style={[
            styles.progressBar, 
            { width: `${progress * 100}%` }
          ]} />
        </View>
        <Text style={styles.progressText}>
          Step {currentStep} of {totalSteps}
        </Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        <Text style={styles.brandName}>Farm2Go</Text>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Join the agricultural marketplace connecting farmers and buyers
        </Text>
        {userType && renderProgressBar()}
      </View>
    </View>
  );

  const renderUserTypeSelection = () => (
    <View style={styles.userTypeSection}>
      <Text style={styles.sectionTitle}>Select Account Type</Text>
      <Text style={styles.sectionSubtitle}>
        Choose the option that best describes your business role
      </Text>

      <TouchableOpacity
        style={[styles.userTypeCard, userType === 'farmer' && styles.selectedCard]}
        onPress={() => {
          setUserType('farmer');
          setCurrentStep(2);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>F</Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Farmer/Producer</Text>
            <Text style={styles.cardDescription}>
              Sell your agricultural products directly to buyers and distributors
            </Text>
            <View style={styles.cardFeatures}>
              <Text style={styles.featureItem}>• Direct sales platform</Text>
              <Text style={styles.featureItem}>• Inventory management</Text>
              <Text style={styles.featureItem}>• Order tracking system</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.userTypeCard, userType === 'buyer' && styles.selectedCard]}
        onPress={() => {
          setUserType('buyer');
          setCurrentStep(2);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>B</Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Buyer/Distributor</Text>
            <Text style={styles.cardDescription}>
              Source fresh produce directly from verified agricultural producers
            </Text>
            <View style={styles.cardFeatures}>
              <Text style={styles.featureItem}>• Direct farm sourcing</Text>
              <Text style={styles.featureItem}>• Supplier verification</Text>
              <Text style={styles.featureItem}>• Bulk order management</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderFormInput = (
    field: string,
    label: string,
    placeholder: string,
    options: {
      required?: boolean;
      keyboardType?: any;
      secureTextEntry?: boolean;
      multiline?: boolean;
      autoCapitalize?: any;
    } = {}
  ) => {
    const isFocused = focusedInput === field;
    const hasValue = formData[field as keyof typeof formData];
    const isPassword = field === 'password';
    const passwordStrength = isPassword && formData.password ? getPasswordStrength(formData.password) : null;

    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {label} {options.required && <Text style={styles.required}>*</Text>}
        </Text>
        <View style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          hasValue && styles.inputWrapperFilled
        ]}>
          <TextInput
            style={[styles.input, options.multiline && styles.textArea]}
            value={formData[field as keyof typeof formData]}
            onChangeText={(value) => handleInputChange(field, value)}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            onFocus={() => setFocusedInput(field)}
            onBlur={() => setFocusedInput(null)}
            {...options}
          />
        </View>
        {isPassword && formData.password && (
          <View style={styles.passwordStrength}>
            <View style={styles.strengthBarContainer}>
              <View style={[
                styles.strengthBar, 
                { 
                  backgroundColor: passwordStrength?.color || '#e5e7eb', 
                  width: `${((passwordStrength?.width || 0) * 100)}%` 
                }
              ]} />
            </View>
            <Text style={[styles.strengthText, { color: passwordStrength?.color || '#6b7280' }]}>
              {passwordStrength?.strength || 'weak'} password
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderRegistrationForm = () => (
    <View style={styles.formSection}>
      <View style={styles.formHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            setUserType(null);
            setCurrentStep(1);
          }}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.selectedUserType}>
          {userType === 'farmer' ? 'Farmer Account' : 'Business Account'}
        </Text>
      </View>

      {/* Personal Information */}
      <View style={styles.formGroup}>
        <Text style={styles.groupTitle}>Personal Information</Text>
        <View style={styles.nameRow}>
          <View style={styles.nameInputHalf}>
            {renderFormInput('firstName', 'First Name', 'Enter first name', { required: true })}
          </View>
          <View style={styles.nameInputHalf}>
            {renderFormInput('lastName', 'Last Name', 'Enter last name', { required: true })}
          </View>
        </View>
        {renderFormInput('middleName', 'Middle Name', 'Enter middle name (optional)')}
        {renderFormInput('email', 'Email Address', 'Enter email address', {
          required: true,
          keyboardType: 'email-address',
          autoCapitalize: 'none'
        })}
        {renderFormInput('phone', 'Phone Number', 'Enter phone number', {
          required: true,
          keyboardType: 'phone-pad'
        })}
        {renderFormInput('password', 'Password', 'Enter password', {
          required: true,
          secureTextEntry: true
        })}
        {renderFormInput('confirmPassword', 'Confirm Password', 'Confirm password', {
          required: true,
          secureTextEntry: true
        })}
      </View>

      {/* Address Information */}
      <View style={styles.formGroup}>
        <Text style={styles.groupTitle}>Address Information</Text>
        <LocationPicker
          onLocationSelect={(barangay) => {
            handleInputChange('barangay', barangay);
          }}
          initialBarangay={formData.barangay}
          focusedInput={focusedInput}
          setFocusedInput={setFocusedInput}
        />
      </View>

      {/* Account Specific Information */}
      {userType === 'farmer' && (
        <View style={styles.formGroup}>
          <Text style={styles.groupTitle}>Farm Information</Text>
          {renderFormInput('farmName', 'Farm Name', 'Enter farm name', { required: true })}
          {renderFormInput('farmSize', 'Farm Size', 'e.g., 50 acres or 20 hectares')}
          {renderFormInput('cropTypes', 'Primary Crop Types', 'e.g., Vegetables, Fruits, Grains', {
            multiline: true
          })}
        </View>
      )}

      {userType === 'buyer' && (
        <View style={styles.formGroup}>
          <Text style={styles.groupTitle}>Business Information</Text>
          {renderFormInput('companyName', 'Company Name', 'Enter company name', { required: true })}
          {renderFormInput('businessType', 'Business Type', 'e.g., Restaurant, Grocery Store, Distributor')}
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.registerButton,
          (isRegistering || rateLimitCooldown > 0) && styles.registerButtonDisabled
        ]}
        onPress={handleRegister}
        disabled={isRegistering || rateLimitCooldown > 0}
      >
        <Text style={styles.registerButtonText}>
          {isRegistering ? 'Creating Account...' : rateLimitCooldown > 0 ? `Wait ${rateLimitCooldown}s` : 'Create Account'}
        </Text>
      </TouchableOpacity>

      {/* Divider - Only show when social buttons are enabled */}
      {true && (
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>
      )}

      {/* Social Login Buttons - Temporarily disabled until OAuth is configured */}
      {true && (
        <View style={styles.socialButtonsContainer}>
          <TouchableOpacity
            style={[styles.socialButton, styles.googleButton]}
            onPress={() => handleSocialSignup('google')}
            disabled={isRegistering}
          >
            <Text style={[styles.socialButtonIcon, styles.googleIcon]}>G</Text>
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, styles.facebookButton]}
            onPress={() => handleSocialSignup('facebook')}
            disabled={isRegistering}
          >
            <Text style={[styles.socialButtonIcon, styles.facebookIcon]}>f</Text>
            <Text style={styles.socialButtonText}>Continue with Facebook</Text>
          </TouchableOpacity>

        </View>
      )}

      {/* Terms */}
      <Text style={styles.termsText}>
        By creating an account, you agree to our{' '}
        <Text style={styles.linkText}>Terms of Service</Text> and{' '}
        <Text style={styles.linkText}>Privacy Policy</Text>
      </Text>

      {/* Login Link */}
      <View style={styles.loginSection}>
        <Text style={styles.loginText}>Already have an account? </Text>
        <Link href="/auth/login">
          <Text style={styles.loginLink}>Sign In</Text>
        </Link>
      </View>
    </View>
  );

  return (
    <>
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
          {renderHeader()}
          <View style={styles.contentContainer}>
            {!userType ? renderUserTypeSelection() : renderRegistrationForm()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {renderSuccessModal()}
      {renderErrorModal()}
    </>
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
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBarBg: {
    width: width * 0.6,
    height: 3,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  progressText: {
    color: '#d1d5db',
    fontSize: 14,
    marginTop: 8,
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
  userTypeSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  userTypeCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    padding: 20,
  },
  selectedCard: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIcon: {
    marginRight: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 12,
  },
  cardFeatures: {
    gap: 4,
  },
  featureItem: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  formSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  selectedUserType: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  formGroup: {
    marginBottom: 32,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  nameRow: {
    flexDirection: width < 600 ? 'column' : 'row',
    gap: 16,
    marginBottom: 0,
  },
  nameInputHalf: {
    flex: 1,
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
  required: {
    color: '#dc2626',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  passwordStrength: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  strengthBarContainer: {
    width: 60,
    height: 3,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginRight: 8,
  },
  strengthBar: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  registerButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  registerButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
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
  socialButtonsContainer: {
    gap: 12,
    marginBottom: 24,
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
  },
  googleButton: {
    borderColor: '#db4437',
  },
  facebookButton: {
    borderColor: '#4267b2',
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
  facebookIcon: {
    backgroundColor: '#4267b2',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#f3f4f6',
  },
  disabledText: {
    color: '#9ca3af',
  },
  termsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
  linkText: {
    color: '#10b981',
    fontWeight: '500',
  },
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  loginText: {
    fontSize: 15,
    color: '#6b7280',
  },
  loginLink: {
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
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkmark: {
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
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorMark: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  errorModalButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
});