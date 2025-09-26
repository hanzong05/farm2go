import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LocationPicker from '../../components/LocationPicker';
import { supabase } from '../../lib/supabase';
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

export default function CompleteProfileScreen() {
  const params = useLocalSearchParams();
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorTitle, setErrorTitle] = useState('');
  const [userType, setUserType] = useState<'farmer' | 'buyer' | null>(null);
  const [oauthUser, setOauthUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    phone: '',
    barangay: '',
    // Farmer specific
    farmName: '',
    farmSize: '',
    cropTypes: '',
    // Buyer specific
    companyName: '',
    businessType: '',
  });

  useEffect(() => {
    const loadOAuthData = async () => {
      try {
        console.log('🔄 Complete Profile: Loading OAuth data...');

        // First, try to recover OAuth session from URL hash if present
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          console.log('🔄 Complete Profile: URL hash:', hash);

          if (hash && hash.includes('access_token=')) {
            console.log('🔄 Complete Profile: Found OAuth tokens in URL, setting session...');

            try {
              // Extract tokens from hash
              const hashParams = new URLSearchParams(hash.substring(1));
              const accessToken = hashParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token');

              if (accessToken && refreshToken) {
                // Set the session manually
                const { data, error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });

                console.log('✅ Complete Profile: Session set from URL tokens:', !!data.session);
                if (error) {
                  console.error('❌ Complete Profile: Session set error:', error);
                } else {
                  // Clear the URL hash
                  window.history.replaceState(null, '', window.location.pathname);

                  // Add small delay to ensure session is fully set
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }
            } catch (error) {
              console.error('❌ Complete Profile: OAuth token recovery error:', error);
            }
          }
        }

        // Get stored user type from AsyncStorage or localStorage
        let storedUserType = await AsyncStorage.getItem('oauth_user_type');

        // If not in AsyncStorage, try localStorage (for web)
        if (!storedUserType && typeof window !== 'undefined') {
          storedUserType = safeLocalStorage.getItem('oauth_user_type');
          console.log('🔄 Complete Profile: Checking localStorage for user type:', storedUserType);
        }

        console.log('🔄 Complete Profile: Final stored user type:', storedUserType);

        if (storedUserType) {
          setUserType(storedUserType as 'farmer' | 'buyer');
        } else {
          console.log('❌ Complete Profile: No stored user type, checking database...');

          // Check if user already has a profile in database by email
          const { data: { user }, error: userError } = await supabase.auth.getUser();

          if (user && user.email) {
            console.log('🔍 Complete Profile: Checking database for existing profile with email:', user.email);

            // Import and use the helper function
            const { checkExistingUserProfile } = await import('../../services/auth');
            const existingProfile = await checkExistingUserProfile(user.email);

            if (existingProfile && existingProfile.user_type) {
              console.log('✅ Complete Profile: Found existing profile with user type:', existingProfile.user_type);
              setUserType(existingProfile.user_type as 'farmer' | 'buyer');

              // Store it for future reference
              await AsyncStorage.setItem('oauth_user_type', existingProfile.user_type);
              if (typeof window !== 'undefined') {
                safeLocalStorage.setItem('oauth_user_type', existingProfile.user_type);
              }
            } else {
              console.log('❌ Complete Profile: No existing profile found, user will need to select');
              setUserType(null);
            }
          } else {
            console.log('❌ Complete Profile: No user found, user will need to select');
            setUserType(null);
          }
        }

        // Get current OAuth user with timeout
        console.log('🔄 Complete Profile: Getting current user...');
        const { data: { user }, error } = await supabase.auth.getUser();
        console.log('🔄 Complete Profile: User result:', user);
        console.log('🔄 Complete Profile: User error:', error);

        if (user) {
          setOauthUser(user);
          console.log('✅ Complete Profile: OAuth user loaded successfully');
          console.log('✅ Complete Profile: User ID:', user.id);
          console.log('✅ Complete Profile: User email:', user.email);
        } else {
          console.log('❌ Complete Profile: No user found, redirecting back to register');
          router.replace('/auth/register');
          return;
        }
      } catch (error) {
        console.error('❌ Complete Profile: Error loading OAuth data:', error);
        router.replace('/auth/register');
        return;
      }
    };

    // Add timeout to prevent infinite loading - increased timeout for slow connections
    const timeoutId = setTimeout(() => {
      console.log('⏰ Complete Profile: Timeout reached, redirecting back to register');
      router.replace('/auth/register');
    }, 15000); // 15 second timeout

    loadOAuthData().then(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getPasswordStrength = (password: string) => {
    if (password.length < 4) return { strength: 'weak', color: colors.danger, width: 0.25 };
    if (password.length < 8) return { strength: 'medium', color: colors.warning, width: 0.65 };
    return { strength: 'strong', color: colors.success, width: 1 };
  };

  const handleCompleteProfile = async () => {
    if (!userType || !oauthUser) {
      setErrorTitle('Error');
      setErrorMessage('Missing OAuth data. Please try signing in again.');
      setShowErrorModal(true);
      return;
    }

    // Validation
    if (!formData.password || !formData.phone || !formData.barangay) {
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

    if (userType === 'farmer' && !formData.farmName) {
      setErrorTitle('Required Fields');
      setErrorMessage('Please fill in your farm name');
      setShowErrorModal(true);
      return;
    }

    setIsCompleting(true);

    try {
      console.log('🚀 Completing OAuth profile...');

      // Extract user data from OAuth
      const firstName = oauthUser.user_metadata?.full_name?.split(' ')[0] ||
                       oauthUser.user_metadata?.given_name ||
                       oauthUser.user_metadata?.first_name || '';

      const lastName = oauthUser.user_metadata?.full_name?.split(' ').slice(1).join(' ') ||
                      oauthUser.user_metadata?.family_name ||
                      oauthUser.user_metadata?.last_name || '';

      // Create complete profile data
      const generateStableId = () => {
        const timestamp = new Date().getTime().toString();
        return `00000000-0000-0000-0000-${timestamp.padStart(12, '0')}`;
      };

      const userId = oauthUser.id.startsWith('mock-user-') || oauthUser.id.startsWith('manual-user-')
        ? generateStableId()
        : oauthUser.id;

      const profileData: Database['public']['Tables']['profiles']['Insert'] = {
        id: userId,
        email: oauthUser.email || '',
        first_name: firstName,
        middle_name: null,
        last_name: lastName,
        phone: formData.phone,
        barangay: formData.barangay,
        user_type: userType,
        farm_name: formData.farmName || null,
        farm_size: formData.farmSize || null,
      };

      console.log('📝 Creating complete profile:', profileData);

      // Insert profile into database with better error handling
      const { data: insertResult, error: profileError } = await supabase
        .from('profiles')
        .insert(profileData as any)
        .select()
        .single();

      console.log('📝 Insert result:', insertResult);
      console.log('📝 Insert error:', profileError);

      if (profileError) {
        console.error('❌ Profile creation error details:', {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint
        });

        // Try a different approach if UUID format issue
        if (profileError.message.includes('invalid input syntax') || profileError.code === '22P02') {
          console.log('🔧 UUID format issue detected, trying with different ID...');

          // Generate a proper UUID v4
          const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });

          const retryProfileData = { ...profileData, id: uuid };
          console.log('🔧 Retrying with UUID:', uuid);

          const { data: retryResult, error: retryError } = await supabase
            .from('profiles')
            .insert(retryProfileData as any)
            .select()
            .single();

          if (retryError) {
            console.error('❌ Retry also failed:', retryError);
            throw retryError;
          } else {
            console.log('✅ Retry successful:', retryResult);
          }
        } else {
          throw profileError;
        }
      }

      console.log('✅ Profile created successfully');

      // Clean up stored user type
      await AsyncStorage.removeItem('oauth_user_type');

      // Also clean up localStorage
      if (typeof window !== 'undefined') {
        safeLocalStorage.removeItem('oauth_user_type');
      }

      // Show success modal
      setShowSuccessModal(true);

    } catch (error: any) {
      console.error('Profile completion error:', error);
      setErrorTitle('Profile Creation Failed');
      setErrorMessage(error.message || 'Please try again.');
      setShowErrorModal(true);
    } finally {
      setIsCompleting(false);
    }
  };

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

  const renderSuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      transparent={true}
      animationKeyframesType="fade"
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.successIconContainer}>
            <Icon name="check" size={32} color={colors.white} />
          </View>
          <Text style={styles.modalTitle}>Profile Completed!</Text>
          <Text style={styles.modalMessage}>
            Your account has been set up successfully. You can now start using Farm2Go.
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => {
              setShowSuccessModal(false);
              // Redirect based on user type
              if (userType === 'farmer') {
                router.replace('/farmer/my-products');
              } else {
                router.replace('/buyer/marketplace');
              }
            }}
          >
            <Text style={styles.modalButtonText}>Continue to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderErrorModal = () => (
    <Modal
      visible={showErrorModal}
      transparent={true}
      animationKeyframesType="fade"
      onRequestClose={() => setShowErrorModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.errorIconContainer}>
            <Icon name="times" size={32} color={colors.white} />
          </View>
          <Text style={styles.modalTitle}>{errorTitle}</Text>
          <Text style={styles.modalMessage}>{errorMessage}</Text>
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

  if (!userType || !oauthUser) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <View style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>Completing your profile setup...</Text>
          <Text style={styles.loadingSubText}>This should only take a moment</Text>
        </View>
      </View>
    );
  }

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
              <Text style={styles.welcomeTitle}>Complete Your Profile</Text>
              <Text style={styles.welcomeSubtitle}>
                Welcome {oauthUser.user_metadata?.full_name || oauthUser.email}!
                {'\n'}Complete your profile to get started.
              </Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <View style={styles.profileCard}>
              {/* User Type Badge */}
              <View style={styles.userTypeBadge}>
                <Icon 
                  name={userType === 'farmer' ? 'seedling' : 'shopping-cart'} 
                  size={16} 
                  color={colors.white} 
                />
                <Text style={styles.userTypeBadgeText}>
                  {userType === 'farmer' ? 'Farmer Account' : 'Business Account'}
                </Text>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Security Section */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>
                    <Icon name="shield-alt" size={16} color={colors.primary} style={styles.sectionIcon} />
                    Security Information
                  </Text>
                  {renderFormInput('password', 'Password', 'Create a secure password', 'lock', {
                    required: true,
                    secureTextEntry: true
                  })}
                  {renderFormInput('confirmPassword', 'Confirm Password', 'Confirm your password', 'lock', {
                    required: true,
                    secureTextEntry: true
                  })}
                </View>

                {/* Contact Information */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>
                    <Icon name="address-book" size={16} color={colors.primary} style={styles.sectionIcon} />
                    Contact Information
                  </Text>
                  {renderFormInput('phone', 'Phone Number', 'Enter your phone number', 'phone', {
                    required: true,
                    keyboardType: 'phone-pad'
                  })}
                  <View style={styles.locationPickerContainer}>
                    <Text style={styles.label}>
                      Location <Text style={styles.required}>*</Text>
                    </Text>
                    <LocationPicker
                      onLocationSelect={(barangay) => {
                        handleInputChange('barangay', barangay);
                      }}
                      initialBarangay={formData.barangay}
                      focusedInput={focusedInput}
                      setFocusedInput={setFocusedInput}
                    />
                  </View>
                </View>

                {/* Account Specific Information */}
                {userType === 'farmer' && (
                  <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>
                      <Icon name="seedling" size={16} color={colors.primary} style={styles.sectionIcon} />
                      Farm Information
                    </Text>
                    {renderFormInput('farmName', 'Farm Name', 'Enter your farm name', 'seedling', { 
                      required: true 
                    })}
                    {renderFormInput('farmSize', 'Farm Size', 'e.g., 50 acres or 20 hectares', 'expand-arrows-alt')}
                    
                    <View style={styles.infoNote}>
                      <Icon name="info-circle" size={14} color={colors.primary} />
                      <Text style={styles.infoNoteText}>
                        Additional farm details can be added later in your profile settings
                      </Text>
                    </View>
                  </View>
                )}

                {userType === 'buyer' && (
                  <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>
                      <Icon name="building" size={16} color={colors.primary} style={styles.sectionIcon} />
                      Business Information
                    </Text>
                    <View style={styles.infoNote}>
                      <Icon name="info-circle" size={14} color={colors.primary} />
                      <Text style={styles.infoNoteText}>
                        Business details are optional and can be added later in your profile settings
                      </Text>
                    </View>
                  </View>
                )}

                {/* Complete Button */}
                <TouchableOpacity
                  style={[styles.completeButton, isCompleting && styles.completeButtonDisabled]}
                  onPress={handleCompleteProfile}
                  disabled={isCompleting}
                >
                  {isCompleting ? (
                    <View style={styles.loadingContainer2}>
                      <View style={styles.buttonSpinner} />
                      <Text style={styles.completeButtonText}>Completing Profile...</Text>
                    </View>
                  ) : (
                    <>
                      <Icon name="user-check" size={16} color={colors.white} style={styles.buttonIcon} />
                      <Text style={styles.completeButtonText}>Complete Profile</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
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

  headerContainer: {
    paddingTop: Platform.OS === 'web' ? (isMobile ? 60 : 80) : (isMobile ? 80 : 100),
    paddingHorizontal: isMobile ? 24 : isTablet ? 32 : 40,
    paddingBottom: isMobile ? 40 : 60,
    alignItems: 'center',
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: isMobile ? 32 : 40,
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
    color: colors.gray800,
    letterSpacing: -0.5,
  },

  welcomeSection: {
    alignItems: 'center',
    zIndex: 1,
  },

  welcomeTitle: {
    fontSize: isMobile ? 20 : 28,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 8,
    textAlign: 'center',
  },

  welcomeSubtitle: {
    fontSize: isMobile ? 14 : 16,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: isMobile ? 20 : 24,
    maxWidth: isMobile ? width * 0.85 : 400,
  },

  contentContainer: {
    flex: 1,
    paddingHorizontal: isMobile ? 24 : isTablet ? 32 : 40,
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: 'center',
  },

  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: isMobile ? 20 : 24,
    width: '100%',
    maxWidth: isMobile ? undefined : 600,
    minHeight: 400,
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

  userTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 24,
    gap: 8,
  },

  userTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  formSection: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionIcon: {
    marginRight: 8,
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

  locationPickerContainer: {
    marginBottom: 16,
  },

  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.green50,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },

  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray600,
    lineHeight: 16,
  },

  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
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

  completeButtonDisabled: {
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

  completeButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  buttonIcon: {
    marginRight: 8,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },

  loadingCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
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

  loadingSpinner: {
    width: 40,
    height: 40,
    borderWidth: 4,
    borderColor: colors.green100,
    borderTopColor: colors.primary,
    borderRadius: 20,
    marginBottom: 24,
    ...Platform.select({
      web: {
        animationKeyframes: 'spin 1s linear infinite',
      },
    }),
  },

  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray800,
    textAlign: 'center',
    marginBottom: 8,
  },

  loadingSubText: {
    fontSize: 14,
    color: colors.gray600,
    textAlign: 'center',
  },

  loadingContainer2: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  buttonSpinner: {
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