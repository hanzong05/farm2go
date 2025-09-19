import { Slot, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function SuperAdminLayout() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const userData = await getUserWithProfile();
      console.log('SuperAdmin Layout - User Data:', userData);
      console.log('SuperAdmin Layout - User Type:', userData?.profile?.user_type);

      if (!userData?.profile) {
        console.log('SuperAdmin Layout - No profile, redirecting to login');
        router.replace('/auth/login');
        return;
      }

      // Check if user is super admin
      if (userData.profile.user_type !== 'super-admin') {
        console.log('SuperAdmin Layout - Not super admin, user type:', userData.profile.user_type);
        Alert.alert('Access Denied', 'You do not have super admin privileges');
        router.replace('/');
        return;
      }

      console.log('SuperAdmin Layout - Access granted');
      setProfile(userData.profile);
    } catch (error) {
      console.error('Error checking super admin access:', error);
      router.replace('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9f4',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9f4',
  },
});