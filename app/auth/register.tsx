import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { registerUser } from '../../services/auth';

const { width, height } = Dimensions.get('window');

type UserType = 'farmer' | 'buyer' | null;

export default function RegisterScreen() {
  const [userType, setUserType] = useState<UserType>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    // Farmer specific
    farmName: '',
    farmLocation: '',
    farmSize: '',
    cropTypes: '',
    // Buyer specific
    companyName: '',
    businessType: '',
    location: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getPasswordStrength = (password: string) => {
    if (password.length < 4) return { strength: 'weak', color: '#ef4444', width: 0.25 };
    if (password.length < 8) return { strength: 'medium', color: '#f59e0b', width: 0.65 };
    return { strength: 'strong', color: '#10b981', width: 1 };
  };

  const handleRegister = async () => {
    // Prevent multiple submissions
    if (isRegistering || rateLimitCooldown > 0) {
      return;
    }

    // Basic validation
    if (!userType) {
      Alert.alert('Selection Required', 'Please select whether you are a farmer or buyer');
      return;
    }

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      Alert.alert('Required Fields', 'Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters long');
      return;
    }

    // Validate farmer-specific required fields
    if (userType === 'farmer') {
      if (!formData.farmName || !formData.farmLocation) {
        Alert.alert('Required Fields', 'Please fill in all required farm information');
        return;
      }
    }

    // Validate buyer-specific required fields
    if (userType === 'buyer') {
      if (!formData.companyName || !formData.location) {
        Alert.alert('Required Fields', 'Please fill in all required business information');
        return;
      }
    }

    setIsRegistering(true);

    try {
      const registrationData = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        userType,
        // Farmer specific fields
        farmName: formData.farmName,
        farmLocation: formData.farmLocation,
        farmSize: formData.farmSize,
        cropTypes: formData.cropTypes,
        // Buyer specific fields
        companyName: formData.companyName,
        businessType: formData.businessType,
        businessLocation: formData.location,
      };

      await registerUser(registrationData);

      Alert.alert('Welcome to Farm2Go!', 'Registration successful! Please check your email to verify your account.', [
        {
          text: 'Continue',
          onPress: () => {
            router.replace('/auth/login');
          }
        }
      ]);
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Handle rate limit error specifically
      if (error.message && error.message.includes('you can only request this after')) {
        const match = error.message.match(/after (\d+) seconds/);
        const seconds = match ? parseInt(match[1]) : 60;
        
        setRateLimitCooldown(seconds);
        
        // Start countdown
        const countdown = setInterval(() => {
          setRateLimitCooldown(prev => {
            if (prev <= 1) {
              clearInterval(countdown);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        Alert.alert(
          'Too Many Attempts',
          `Please wait ${seconds} seconds before trying again. This security measure helps protect against spam registrations.`,
          [{ text: 'OK' }]
        );
      } else {
        // Handle other errors
        let errorMessage = 'Please try again.';
        
        if (error.message) {
          if (error.message.includes('Email already registered')) {
            errorMessage = 'This email is already registered. Please try signing in instead.';
          } else if (error.message.includes('Invalid email')) {
            errorMessage = 'Please enter a valid email address.';
          } else if (error.message.includes('Password')) {
            errorMessage = 'Password must be at least 6 characters long.';
          } else {
            errorMessage = error.message;
          }
        }
        
        Alert.alert('Registration Failed', errorMessage);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const renderProgressBar = () => {
    const totalSteps = userType ? 2 : 1;
    const progress = currentStep / totalSteps;
    const progressWidth = progress * (width * 0.6);
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View style={[
            styles.progressBar, 
            { width: progressWidth }
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
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logo}>🌱</Text>
          </View>
          <Text style={styles.brandName}>Farm2Go</Text>
        </View>
        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.subtitle}>
          Join thousands of farmers and buyers connecting directly
        </Text>
        {userType && renderProgressBar()}
      </View>
    </View>
  );

  const renderUserTypeSelection = () => (
    <View style={styles.userTypeSection}>
      <Text style={styles.sectionTitle}>Choose Your Role</Text>
      <Text style={styles.sectionSubtitle}>
        Select the option that best describes your business
      </Text>

      <TouchableOpacity
        style={[styles.userTypeCard, styles.farmerCard]}
        onPress={() => {
          setUserType('farmer');
          setCurrentStep(2);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, styles.farmerIcon]}>
              <Text style={styles.userTypeEmoji}>🌾</Text>
            </View>
            <View style={[styles.cardBadge, styles.farmerBadge]}>
              <Text style={styles.badgeText}>PRODUCER</Text>
            </View>
          </View>
          <Text style={styles.userTypeTitle}>Farmer / Producer</Text>
          <Text style={styles.userTypeDescription}>
            Sell your fresh produce directly to buyers, manage inventory, and track orders
          </Text>
          <View style={styles.cardFeatures}>
            <Text style={styles.featureText}>• Direct sales to buyers</Text>
            <Text style={styles.featureText}>• Inventory management</Text>
            <Text style={styles.featureText}>• Order tracking</Text>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardCta}>Get Started →</Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.userTypeCard, styles.buyerCard]}
        onPress={() => {
          setUserType('buyer');
          setCurrentStep(2);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, styles.buyerIcon]}>
              <Text style={styles.userTypeEmoji}>🏢</Text>
            </View>
            <View style={[styles.cardBadge, styles.buyerBadge]}>
              <Text style={styles.badgeText}>BUSINESS</Text>
            </View>
          </View>
          <Text style={styles.userTypeTitle}>Buyer / Distributor</Text>
          <Text style={styles.userTypeDescription}>
            Source fresh produce directly from farms, manage suppliers, and streamline procurement
          </Text>
          <View style={styles.cardFeatures}>
            <Text style={styles.featureText}>• Direct farm sourcing</Text>
            <Text style={styles.featureText}>• Supplier management</Text>
            <Text style={styles.featureText}>• Bulk ordering</Text>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardCta}>Get Started →</Text>
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
        <Text style={[styles.label, isFocused && styles.labelFocused]}>
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
          {userType === 'farmer' ? '🌾 Farmer Account' : '🏢 Business Account'}
        </Text>
      </View>

      {/* Personal Information */}
      <View style={styles.formGroup}>
        <View style={styles.groupTitleContainer}>
          <Text style={styles.groupTitle}>Personal Information</Text>
          <View style={styles.titleUnderline} />
        </View>
        <View style={styles.inputRow}>
          <View style={styles.inputHalf}>
            {renderFormInput('firstName', 'First Name', 'Enter first name', { required: true })}
          </View>
          <View style={styles.inputHalf}>
            {renderFormInput('lastName', 'Last Name', 'Enter last name', { required: true })}
          </View>
        </View>
        {renderFormInput('email', 'Email Address', 'Enter email address', {
          required: true,
          keyboardType: 'email-address',
          autoCapitalize: 'none'
        })}
        {renderFormInput('phone', 'Phone Number', 'Enter phone number', {
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

      {/* Farmer Specific Fields */}
      {userType === 'farmer' && (
        <View style={styles.formGroup}>
          <View style={styles.groupTitleContainer}>
            <Text style={styles.groupTitle}>Farm Information</Text>
            <View style={styles.titleUnderline} />
          </View>
          {renderFormInput('farmName', 'Farm Name', 'Enter farm name', { required: true })}
          {renderFormInput('farmLocation', 'Farm Location', 'City, State/Province', { required: true })}
          {renderFormInput('farmSize', 'Farm Size', 'e.g., 50 acres or 20 hectares')}
          {renderFormInput('cropTypes', 'Primary Crop Types', 'e.g., Vegetables, Fruits, Grains', {
            multiline: true
          })}
        </View>
      )}

      {/* Buyer Specific Fields */}
      {userType === 'buyer' && (
        <View style={styles.formGroup}>
          <View style={styles.groupTitleContainer}>
            <Text style={styles.groupTitle}>Business Information</Text>
            <View style={styles.titleUnderline} />
          </View>
          {renderFormInput('companyName', 'Company Name', 'Enter company name', { required: true })}
          {renderFormInput('businessType', 'Business Type', 'e.g., Restaurant, Grocery Store, Distributor')}
          {renderFormInput('location', 'Business Location', 'City, State/Province', { required: true })}
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity 
        style={[
          styles.registerButton, 
          (isRegistering || rateLimitCooldown > 0) && styles.registerButtonDisabled
        ]} 
        onPress={handleRegister} 
        activeOpacity={0.9}
        disabled={isRegistering || rateLimitCooldown > 0}
      >
        <View style={styles.buttonContent}>
          <Text style={styles.registerButtonText}>
            {isRegistering ? 'Creating Account...' : rateLimitCooldown > 0 ? `Wait ${rateLimitCooldown}s` : 'Create My Account'}
          </Text>
          <Text style={styles.buttonSubtext}>
            {isRegistering ? 'Please wait...' : rateLimitCooldown > 0 ? 'Rate limit active' : 'Start connecting today'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Terms and Privacy */}
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
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {renderHeader()}
      <View style={styles.contentContainer}>
        {!userType ? renderUserTypeSelection() : renderRegistrationForm()}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    backgroundColor: '#059669',
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logo: {
    fontSize: 24,
  },
  brandName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: width < 768 ? 26 : 30,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: width < 768 ? 16 : 18,
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 24,
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBarBg: {
    width: width * 0.6,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  progressText: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 8,
    opacity: 0.8,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 32,
  },
  userTypeSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  userTypeCard: {
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  farmerCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  buyerCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  cardContent: {
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  farmerIcon: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  buyerIcon: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  userTypeEmoji: {
    fontSize: 28,
  },
  cardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  farmerBadge: {
    backgroundColor: '#059669',
  },
  buyerBadge: {
    backgroundColor: '#dc2626',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  userTypeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  userTypeDescription: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
    marginBottom: 16,
  },
  cardFeatures: {
    marginBottom: 20,
  },
  featureText: {
    fontSize: 14,
    color: '#059669',
    marginBottom: 4,
    fontWeight: '500',
  },
  cardFooter: {
    alignItems: 'flex-end',
  },
  cardCta: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  formSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '600',
  },
  selectedUserType: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  formGroup: {
    marginBottom: 32,
  },
  groupTitleContainer: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  titleUnderline: {
    width: 40,
    height: 3,
    backgroundColor: '#059669',
    borderRadius: 2,
  },
  inputRow: {
    flexDirection: width < 768 ? 'column' : 'row',
    gap: 16,
  },
  inputHalf: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  labelFocused: {
    color: '#059669',
  },
  required: {
    color: '#ef4444',
  },
  inputWrapper: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  inputWrapperFocused: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  inputWrapperFilled: {
    borderColor: '#d1d5db',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
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
    backgroundColor: '#059669',
    borderRadius: 16,
    marginTop: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  registerButtonDisabled: {
    backgroundColor: '#9ca3af',
    elevation: 2,
    shadowOpacity: 0.1,
  },
  buttonContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  buttonSubtext: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.8,
  },
  termsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
  linkText: {
    color: '#059669',
    fontWeight: '600',
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
    fontSize: 16,
    color: '#6b7280',
  },
  loginLink: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '600',
  },
});