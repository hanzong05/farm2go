import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LocationPicker from '../../components/LocationPicker';
import { supabase } from '../../lib/supabase';
import { Database } from '../../types/database';

const { width, height } = Dimensions.get('window');

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
          storedUserType = localStorage.getItem('oauth_user_type');
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
                localStorage.setItem('oauth_user_type', existingProfile.user_type);
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
    if (password.length < 4) return { strength: 'weak', color: '#dc2626', width: 0.25 };
    if (password.length < 8) return { strength: 'medium', color: '#d97706', width: 0.65 };
    return { strength: 'strong', color: '#059669', width: 1 };
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
      setErrorMessage('Please fill in all required farm information');
      setShowErrorModal(true);
      return;
    }

    if (userType === 'buyer' && !formData.companyName) {
      setErrorTitle('Required Fields');
      setErrorMessage('Please fill in all required business information');
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
      // For mock users, create a UUID-like ID that Supabase will accept
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
        middle_name: null, // Can be added to form if needed
        last_name: lastName,
        phone: formData.phone,
        barangay: formData.barangay,
        user_type: userType,
        // Farmer fields
        farm_name: formData.farmName || null,
        farm_location: formData.barangay, // Use barangay as farm location
        farm_size: formData.farmSize || null,
        crop_types: formData.cropTypes || null,
        // Buyer fields
        company_name: formData.companyName || null,
        business_type: formData.businessType || null,
        business_location: formData.barangay, // Use barangay as business location
      };

      console.log('📝 Creating complete profile:', profileData);
      console.log('📝 Profile data ID:', profileData.id);
      console.log('📝 Profile data type:', typeof profileData.id);

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
        localStorage.removeItem('oauth_user_type');
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
      animationType="fade"
      onRequestClose={() => setShowErrorModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorMark}>✕</Text>
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
        <Text style={styles.loadingText}>Loading complete profile...</Text>
        <Text style={styles.loadingSubText}>This should only take a moment</Text>

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
        >
          <View style={styles.headerContainer}>
            <View style={styles.header}>
              <Text style={styles.brandName}>Farm2Go</Text>
              <Text style={styles.title}>Complete Your Profile</Text>
              <Text style={styles.subtitle}>
                Welcome {oauthUser.user_metadata?.full_name || oauthUser.email}!
                Please complete your profile to get started.
              </Text>
            </View>
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.formSection}>
              {/* User Type Selection (if not already stored) */}
              {!userType ? (
                <View style={styles.userTypeSelection}>
                  <Text style={styles.userTypeTitle}>Select Your Account Type</Text>
                  <Text style={styles.userTypeSubtitle}>Choose the option that best describes you</Text>

                  <View style={styles.userTypeButtons}>
                    <TouchableOpacity
                      style={styles.userTypeButton}
                      onPress={() => setUserType('farmer')}
                    >
                      <Text style={styles.userTypeButtonIcon}>🌱</Text>
                      <Text style={styles.userTypeButtonText}>Farmer/Producer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.userTypeButton}
                      onPress={() => setUserType('buyer')}
                    >
                      <Text style={styles.userTypeButtonIcon}>🏢</Text>
                      <Text style={styles.userTypeButtonText}>Buyer/Distributor</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.selectedUserType}>
                  {userType === 'farmer' ? 'Farmer Account' : 'Business Account'}
                </Text>
              )}

              {/* Password Section */}
              <View style={styles.formGroup}>
                <Text style={styles.groupTitle}>Security</Text>
                {renderFormInput('password', 'Password', 'Create a password', {
                  required: true,
                  secureTextEntry: true
                })}
                {renderFormInput('confirmPassword', 'Confirm Password', 'Confirm your password', {
                  required: true,
                  secureTextEntry: true
                })}
              </View>

              {/* Contact Information */}
              <View style={styles.formGroup}>
                <Text style={styles.groupTitle}>Contact Information</Text>
                {renderFormInput('phone', 'Phone Number', 'Enter phone number', {
                  required: true,
                  keyboardType: 'phone-pad'
                })}
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

              {/* Complete Button */}
              <TouchableOpacity
                style={[styles.completeButton, isCompleting && styles.completeButtonDisabled]}
                onPress={handleCompleteProfile}
                disabled={isCompleting}
              >
                <Text style={styles.completeButtonText}>
                  {isCompleting ? 'Completing Profile...' : 'Complete Profile'}
                </Text>
              </TouchableOpacity>
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
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  loadingSubText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  continueButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  formSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  selectedUserType: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 32,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
    overflow: 'hidden',
  },
  userTypeSelection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  userTypeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  userTypeSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  userTypeButtons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  userTypeButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  userTypeButtonIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  userTypeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 32,
    padding: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
    marginTop: -4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputWrapperFocused: {
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  completeButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  completeButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowColor: '#9ca3af',
    shadowOpacity: 0.1,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles (reused from register screen)
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
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
    shadowColor: '#dc2626',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});