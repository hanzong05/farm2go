import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LocationPicker from '../../components/LocationPicker';
import { supabase } from '../../lib/supabase';
import { registerUser, signInWithFacebook, signInWithGoogle } from '../../services/auth';
import { Database } from '../../types/database';
import { safeLocalStorage } from '../../utils/platformUtils';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

            if (typeof window !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search);
              const emailFromUrl = urlParams.get('email');

              if (emailFromUrl) {
                console.log('🔍 Checking for existing profile with email from URL:', emailFromUrl);
                const { checkExistingUserProfile } = await import('../../services/auth');
                const existingProfile = await checkExistingUserProfile(emailFromUrl);

                if (existingProfile && existingProfile.user_type) {
                  console.log('✅ Found existing profile, updating stored user type');
                  await AsyncStorage.setItem('oauth_user_type', existingProfile.user_type);
                  safeLocalStorage.setItem('oauth_user_type', existingProfile.user_type);
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

          if (!storedUserType && session.user.email) {
            console.log('🔍 No stored user type, checking database for existing profile...');
            const { checkExistingUserProfile } = await import('../../services/auth');
            const existingProfile = await checkExistingUserProfile(session.user.email);

            if (existingProfile && existingProfile.user_type) {
              console.log('✅ Found existing profile with user type:', existingProfile.user_type);
              storedUserType = existingProfile.user_type;

              await AsyncStorage.setItem('oauth_user_type', existingProfile.user_type);
              if (typeof window !== 'undefined') {
                safeLocalStorage.setItem('oauth_user_type', existingProfile.user_type);
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
    if (password.length < 4) return { strength: 'weak', color: colors.danger, width: 0.25 };
    if (password.length < 8) return { strength: 'medium', color: colors.warning, width: 0.65 };
    return { strength: 'strong', color: colors.success, width: 1 };
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

      const { sessionManager } = await import('../../services/sessionManager');
      await sessionManager.storeOAuthState({
        intent: 'registration',
        userType: userType,
        source: 'register_page'
      });
      console.log('💾 Stored OAuth state for registration:', userType);

      if (provider === 'google') {
        console.log('🔄 Initiating Google OAuth...');
        const result = await signInWithGoogle(true);
        console.log('📤 Google OAuth result:', result);
      } else {
        console.log('🔄 Initiating Facebook OAuth...');
        const result = await signInWithFacebook();
        console.log('📤 Facebook OAuth result:', result);
      }

      console.log('🔄 OAuth initiated, user should be redirected to provider...');

    } catch (error: any) {
      console.error(`❌ ${provider} registration error:`, error);

      const { sessionManager } = await import('../../services/sessionManager');
      await sessionManager.clearOAuthState();

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
          <View style={styles.successIconContainer}>
            <Icon name="check" size={32} color={colors.white} />
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
          <View style={styles.errorIconContainer}>
            <Icon name="times" size={32} color={colors.white} />
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
      {/* Background Pattern */}
      <View style={styles.backgroundPattern}>
        <View style={[styles.patternCircle, styles.circle1]} />
        <View style={[styles.patternCircle, styles.circle2]} />
        <View style={[styles.patternCircle, styles.circle3]} />
      </View>

      <View style={styles.logoContainer}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>F2G</Text>
        </View>
        <Text style={styles.brandName}>Farm2Go</Text>
      </View>
      
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeTitle}>Create Account</Text>
        <Text style={styles.welcomeSubtitle}>
          Join the agricultural marketplace connecting farmers and buyers
        </Text>
      </View>

      {userType && renderProgressBar()}
    </View>
  );

  const renderUserTypeSelection = () => (
    <View style={styles.contentContainer}>
      <View style={styles.userTypeCard}>
        <Text style={styles.sectionTitle}>Select Account Type</Text>
        <Text style={styles.sectionSubtitle}>
          Choose the option that best describes your business role
        </Text>

        <TouchableOpacity
          style={[styles.userTypeOption, userType === 'farmer' && styles.selectedOption]}
          onPress={() => {
            setUserType('farmer');
            setCurrentStep(2);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.optionHeader}>
            <View style={styles.optionIconContainer}>
              <Icon name="seedling" size={24} color={userType === 'farmer' ? colors.white : colors.primary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, userType === 'farmer' && styles.selectedOptionTitle]}>
                Farmer/Producer
              </Text>
              <Text style={[styles.optionDescription, userType === 'farmer' && styles.selectedOptionText]}>
                Sell your agricultural products directly to buyers and distributors
              </Text>
            </View>
          </View>
          <View style={styles.optionFeatures}>
            <View style={styles.featureRow}>
              <Icon name="check" size={12} color={userType === 'farmer' ? colors.green200 : colors.gray400} />
              <Text style={[styles.featureText, userType === 'farmer' && styles.selectedFeatureText]}>
                Direct sales platform
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Icon name="check" size={12} color={userType === 'farmer' ? colors.green200 : colors.gray400} />
              <Text style={[styles.featureText, userType === 'farmer' && styles.selectedFeatureText]}>
                Inventory management
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Icon name="check" size={12} color={userType === 'farmer' ? colors.green200 : colors.gray400} />
              <Text style={[styles.featureText, userType === 'farmer' && styles.selectedFeatureText]}>
                Order tracking system
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.userTypeOption, userType === 'buyer' && styles.selectedOption]}
          onPress={() => {
            setUserType('buyer');
            setCurrentStep(2);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.optionHeader}>
            <View style={styles.optionIconContainer}>
              <Icon name="shopping-cart" size={24} color={userType === 'buyer' ? colors.white : colors.primary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, userType === 'buyer' && styles.selectedOptionTitle]}>
                Buyer/Distributor
              </Text>
              <Text style={[styles.optionDescription, userType === 'buyer' && styles.selectedOptionText]}>
                Source fresh produce directly from verified agricultural producers
              </Text>
            </View>
          </View>
          <View style={styles.optionFeatures}>
            <View style={styles.featureRow}>
              <Icon name="check" size={12} color={userType === 'buyer' ? colors.green200 : colors.gray400} />
              <Text style={[styles.featureText, userType === 'buyer' && styles.selectedFeatureText]}>
                Direct farm sourcing
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Icon name="check" size={12} color={userType === 'buyer' ? colors.green200 : colors.gray400} />
              <Text style={[styles.featureText, userType === 'buyer' && styles.selectedFeatureText]}>
                Supplier verification
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Icon name="check" size={12} color={userType === 'buyer' ? colors.green200 : colors.gray400} />
              <Text style={[styles.featureText, userType === 'buyer' && styles.selectedFeatureText]}>
                Bulk order management
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFormInput = (
    field: string,
    label: string,
    placeholder: string,
    iconName: string,
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
    const isConfirmPassword = field === 'confirmPassword';
    const passwordStrength = isPassword && formData.password ? getPasswordStrength(formData.password) : null;

    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {label} {options.required && <Text style={styles.required}>*</Text>}
        </Text>
        <View style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          hasValue && styles.inputWrapperFilled,
          options.multiline && styles.textAreaWrapper
        ]}>
          <Icon 
            name={iconName} 
            size={16} 
            color={isFocused ? colors.primary : colors.gray400} 
            style={styles.inputIcon}
          />
          <TextInput
            style={[styles.input, options.multiline && styles.textArea]}
            value={formData[field as keyof typeof formData]}
            onChangeText={(value) => handleInputChange(field, value)}
            placeholder={placeholder}
            placeholderTextColor={colors.gray400}
            onFocus={() => setFocusedInput(field)}
            onBlur={() => setFocusedInput(null)}
            secureTextEntry={isPassword ? !showPassword : isConfirmPassword ? !showConfirmPassword : options.secureTextEntry}
            {...options}
          />
          {(isPassword || isConfirmPassword) && (
            <TouchableOpacity 
              onPress={() => {
                if (isPassword) setShowPassword(!showPassword);
                if (isConfirmPassword) setShowConfirmPassword(!showConfirmPassword);
              }}
              style={styles.passwordToggle}
            >
              <Icon 
                name={
                  isPassword 
                    ? (showPassword ? 'eye-slash' : 'eye')
                    : (showConfirmPassword ? 'eye-slash' : 'eye')
                } 
                size={14} 
                color={colors.gray400} 
              />
            </TouchableOpacity>
          )}
        </View>
        {isPassword && formData.password && (
          <View style={styles.passwordStrength}>
            <View style={styles.strengthBarContainer}>
              <View style={[
                styles.strengthBar, 
                { 
                  backgroundColor: passwordStrength?.color || colors.gray200, 
                  width: `${((passwordStrength?.width || 0) * 100)}%` 
                }
              ]} />
            </View>
            <Text style={[styles.strengthText, { color: passwordStrength?.color || colors.gray500 }]}>
              {passwordStrength?.strength || 'weak'} password
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderRegistrationForm = () => (
    <View style={styles.contentContainer}>
      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              setUserType(null);
              setCurrentStep(1);
            }}
          >
            <Icon name="arrow-left" size={16} color={colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.userTypeBadge}>
            <Icon 
              name={userType === 'farmer' ? 'seedling' : 'shopping-cart'} 
              size={14} 
              color={colors.white} 
            />
            <Text style={styles.userTypeBadgeText}>
              {userType === 'farmer' ? 'Farmer Account' : 'Business Account'}
            </Text>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Personal Information */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.nameRow}>
              <View style={styles.nameInputHalf}>
                {renderFormInput('firstName', 'First Name', 'Enter first name', 'user', { required: true })}
              </View>
              <View style={styles.nameInputHalf}>
                {renderFormInput('lastName', 'Last Name', 'Enter last name', 'user', { required: true })}
              </View>
            </View>
            {renderFormInput('middleName', 'Middle Name', 'Enter middle name (optional)', 'user')}
            {renderFormInput('email', 'Email Address', 'Enter email address', 'envelope', {
              required: true,
              keyboardType: 'email-address',
              autoCapitalize: 'none'
            })}
            {renderFormInput('phone', 'Phone Number', 'Enter phone number', 'phone', {
              required: true,
              keyboardType: 'phone-pad'
            })}
            {renderFormInput('password', 'Password', 'Enter password', 'lock', {
              required: true,
              secureTextEntry: true
            })}
            {renderFormInput('confirmPassword', 'Confirm Password', 'Confirm password', 'lock', {
              required: true,
              secureTextEntry: true
            })}
          </View>

          {/* Address Information */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Address Information</Text>
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
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Farm Information</Text>
              {renderFormInput('farmName', 'Farm Name', 'Enter farm name', 'seedling', { required: true })}
              {renderFormInput('farmSize', 'Farm Size', 'e.g., 50 acres or 20 hectares', 'expand-arrows-alt')}
              {renderFormInput('cropTypes', 'Primary Crop Types', 'e.g., Vegetables, Fruits, Grains', 'leaf', {
                multiline: true
              })}
            </View>
          )}

          {userType === 'buyer' && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Business Information</Text>
              {renderFormInput('companyName', 'Company Name', 'Enter company name', 'building', { required: true })}
              {renderFormInput('businessType', 'Business Type', 'e.g., Restaurant, Grocery Store, Distributor', 'briefcase')}
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
            {isRegistering ? (
              <View style={styles.loadingContainer}>
                <View style={styles.loadingSpinner} />
                <Text style={styles.registerButtonText}>Creating Account...</Text>
              </View>
            ) : rateLimitCooldown > 0 ? (
              <Text style={styles.registerButtonText}>Wait {rateLimitCooldown}s</Text>
            ) : (
              <>
                <Icon name="user-plus" size={16} color={colors.white} style={styles.buttonIcon} />
                <Text style={styles.registerButtonText}>Create Account</Text>
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

          {/* Social Login Buttons */}
          <View style={styles.socialButtonsContainer}>
            <TouchableOpacity
              style={[styles.socialButton, isRegistering && styles.socialButtonDisabled]}
              onPress={() => handleSocialSignup('google')}
              disabled={isRegistering}
            >
              <View style={styles.googleIcon}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, isRegistering && styles.socialButtonDisabled]}
              onPress={() => handleSocialSignup('facebook')}
              disabled={isRegistering}
            >
              <View style={styles.facebookIcon}>
                <Text style={styles.facebookIconText}>f</Text>
              </View>
              <Text style={styles.socialButtonText}>Continue with Facebook</Text>
            </TouchableOpacity>
          </View>

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
        </ScrollView>
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
          contentContainerStyle={styles.scrollContent}
        >
          {renderHeader()}
          {!userType ? renderUserTypeSelection() : renderRegistrationForm()}
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
    backgroundColor: colors.background,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    minHeight: height,
  },

  // Header Styles
  headerContainer: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'web' ? (isMobile ? 60 : 80) : (isMobile ? 80 : 100),
    paddingHorizontal: isMobile ? 24 : isTablet ? 32 : 40,
    paddingBottom: isMobile ? 40 : 60,
    position: 'relative',
  },

  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },

  patternCircle: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: colors.green200,
    opacity: 0.2,
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

  logoContainer: {
    alignItems: 'center',
    marginBottom: isMobile ? 24 : 32,
    zIndex: 1,
  },

  logo: {
    width: isMobile ? 56 : 72,
    height: isMobile ? 56 : 72,
    borderRadius: isMobile ? 14 : 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
    fontSize: isMobile ? 20 : 28,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: -1,
  },

  brandName: {
    fontSize: isMobile ? 24 : 32,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.5,
  },

  welcomeSection: {
    alignItems: 'center',
    marginBottom: isMobile ? 16 : 24,
    zIndex: 1,
  },

  welcomeTitle: {
    fontSize: isMobile ? 20 : 28,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },

  welcomeSubtitle: {
    fontSize: isMobile ? 14 : 16,
    color: colors.green100,
    textAlign: 'center',
    lineHeight: isMobile ? 20 : 24,
    maxWidth: isMobile ? width * 0.85 : 400,
  },

  progressContainer: {
    alignItems: 'center',
    zIndex: 1,
  },

  progressBarBg: {
    width: isMobile ? width * 0.6 : 240,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 2,
    ...Platform.select({
      web: {
        transition: 'width 0.3s ease-in-out',
      },
    }),
  },

  progressText: {
    color: colors.green100,
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },

  // Content Styles
  contentContainer: {
    flex: 1,
    paddingHorizontal: isMobile ? 24 : isTablet ? 32 : 40,
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: 'center',
  },

  // User Type Selection
  userTypeCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: isMobile ? 24 : 32,
    width: '100%',
    maxWidth: isMobile ? undefined : 600,
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

  sectionTitle: {
    fontSize: isMobile ? 20 : 24,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 8,
    textAlign: 'center',
  },

  sectionSubtitle: {
    fontSize: isMobile ? 14 : 16,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: isMobile ? 20 : 24,
  },

  userTypeOption: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: colors.gray50,
    borderWidth: 2,
    borderColor: colors.gray200,
    padding: 20,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease-in-out',
      },
    }),
  },

  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
      },
      default: {
        elevation: 6,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },

  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },

  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.green100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },

  optionContent: {
    flex: 1,
  },

  optionTitle: {
    fontSize: isMobile ? 18 : 20,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 8,
  },

  selectedOptionTitle: {
    color: colors.white,
  },

  optionDescription: {
    fontSize: 14,
    color: colors.gray600,
    lineHeight: 20,
  },

  selectedOptionText: {
    color: colors.green100,
  },

  optionFeatures: {
    gap: 8,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  featureText: {
    fontSize: 13,
    color: colors.gray600,
    fontWeight: '500',
  },

  selectedFeatureText: {
    color: colors.green200,
  },

  // Form Styles
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: isMobile ? 20 : 24,
    width: '100%',
    maxWidth: isMobile ? undefined : 600,
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

  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },

  backButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  userTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },

  userTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  formSection: {
    marginBottom: 24,
  },

  nameRow: {
    flexDirection: isMobile ? 'column' : 'row',
    gap: 16,
  },

  nameInputHalf: {
    flex: 1,
  },

  inputContainer: {
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: 8,
  },

  required: {
    color: colors.danger,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gray200,
    borderRadius: 12,
    backgroundColor: colors.gray50,
    paddingHorizontal: 16,
    minHeight: 48,
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

  textAreaWrapper: {
    alignItems: 'flex-start',
    minHeight: 80,
  },

  inputIcon: {
    marginRight: 12,
    width: 16,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: colors.gray800,
    paddingVertical: 16,
  },

  textArea: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 16,
  },

  passwordToggle: {
    padding: 8,
  },

  passwordStrength: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  strengthBarContainer: {
    width: 60,
    height: 3,
    backgroundColor: colors.gray200,
    borderRadius: 2,
    marginRight: 8,
    overflow: 'hidden',
  },

  strengthBar: {
    height: '100%',
    borderRadius: 2,
    ...Platform.select({
      web: {
        transition: 'all 0.3s ease-in-out',
      },
    }),
  },

  strengthText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
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

  registerButtonDisabled: {
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

  registerButtonText: {
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
        animation: 'spin 1s linear infinite',
      },
    }),
  },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    minHeight: 48,
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

  facebookIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4267b2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  facebookIconText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.white,
  },

  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray700,
  },

  termsText: {
    fontSize: 13,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
    lineHeight: 18,
  },

  linkText: {
    color: colors.primary,
    fontWeight: '600',
  },

  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },

  loginText: {
    fontSize: 14,
    color: colors.gray600,
  },

  loginLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  // Modal Styles
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

  successIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  errorIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.danger,
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
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
  },

  errorModalButton: {
    backgroundColor: colors.danger,
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