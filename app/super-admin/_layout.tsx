import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function SuperAdminLayout() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        router.replace('/auth/login');
        return;
      }

      // Check if user is super admin (you can modify this logic based on your needs)
      if (userData.profile.user_type !== 'admin') {
        Alert.alert('Access Denied', 'You do not have super admin privileges');
        router.replace('/');
        return;
      }

      setProfile(userData.profile);
    } catch (error) {
      console.error('Error checking super admin access:', error);
      router.replace('/auth/login');
    }
  };

  return (
    <View style={styles.container}>
      {/* Super admin content will be rendered here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9f4',
  },
});