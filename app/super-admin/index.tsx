import { router } from 'expo-router';
import React, { useEffect } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { getUserWithProfile } from '../../services/auth';

const colors = {
  primary: '#059669',
  background: '#f0f9f4',
  textSecondary: '#6b7280',
};

export default function SuperAdminIndex() {
  useEffect(() => {
    // Redirect super-admin to users management page
    const checkAndRedirect = async () => {
      try {
        const userData = await getUserWithProfile();
        if (!userData?.profile) {
          router.replace('/auth/login');
          return;
        }

        if (userData.profile.user_type !== 'super-admin') {
          Alert.alert('Access Denied', 'You do not have super admin privileges');
          router.replace('/');
          return;
        }

        // Redirect to users management
        router.replace('/super-admin/users');
      } catch (error) {
        console.error('Error checking super admin access:', error);
        router.replace('/auth/login');
      }
    };

    checkAndRedirect();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Redirecting to User Management...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
