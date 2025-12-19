import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { showError } from '../utils/alert';
import VerificationStatus from './VerificationStatus';
import VerificationUpload from './VerificationUpload';

interface VerificationGuardProps {
  userId: string;
  userType: 'farmer' | 'buyer';
  action: 'sell' | 'buy';
  children: React.ReactNode;
  onVerificationRequired?: () => void;
}

export default function VerificationGuard({
  userId,
  userType,
  action,
  children,
  onVerificationRequired,
}: VerificationGuardProps) {
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    checkVerificationStatus();
  }, [userId]);

  const checkVerificationStatus = async () => {
    try {
      // Check verification_submissions table for the most accurate status
      const { data, error } = await supabase
        .from('verification_submissions')
        .select('status')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      // If user has no verification submission, status is 'not_submitted'
      // Otherwise, use the latest submission status
      const latestSubmission = data && data.length > 0 ? data[0] : null;
      setVerificationStatus(latestSubmission?.status || 'not_submitted');
    } catch (error) {
      console.error('Error checking verification status:', error);
      showError('Failed to check verification status');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationPressed = () => {
    if (verificationStatus === 'not_submitted' || verificationStatus === 'rejected') {
      setShowUpload(true);
    } else if (verificationStatus === 'pending') {
      // Navigate to verification status page for pending submissions
      router.push('/verification/status');
    } else if (verificationStatus === 'approved') {
      // Navigate to verification certificate/status page for approved users
      router.push('/verification/status');
    }

    if (onVerificationRequired) {
      onVerificationRequired();
    }
  };

  const handleVerificationSubmitted = () => {
    try {
      setShowUpload(false);
      setVerificationStatus('pending');
      // Add success feedback without immediately showing another alert
      // since the VerificationUpload component already shows one
      console.log('✅ Verification submitted successfully, status updated to pending');
    } catch (error) {
      console.error('Error handling verification submission:', error);
      showError('Failed to update verification status. Please refresh the page.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Checking verification status...</Text>
      </View>
    );
  }

  // If user is approved, show the protected content
  if (verificationStatus === 'approved') {
    return <>{children}</>;
  }

  // If showing upload form
  if (showUpload && (verificationStatus === 'not_submitted' || verificationStatus === 'rejected')) {
    return (
      <VerificationUpload
        userId={userId}
        userType={userType}
        onVerificationSubmitted={handleVerificationSubmitted}
      />
    );
  }

  // Show verification status for non-approved users
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {action === 'sell' ? 'Selling Products' : 'Purchasing Products'}
        </Text>
        <Text style={styles.subtitle}>
          Identity verification is required to {action === 'sell' ? 'sell products' : 'make purchases'} on Farm2Go
        </Text>
      </View>

      <VerificationStatus
        verificationStatus={verificationStatus as any}
        userType={userType}
        onVerificationPress={handleVerificationPressed}
      />

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Why do we need verification?</Text>
        <View style={styles.infoList}>
          <Text style={styles.infoItem}>• Ensure all users are genuine</Text>
          <Text style={styles.infoItem}>• Protect against fraud and scams</Text>
          <Text style={styles.infoItem}>• Build trust in the marketplace</Text>
          <Text style={styles.infoItem}>• Comply with regulations</Text>
          <Text style={styles.infoItem}>• Secure transactions for everyone</Text>
        </View>
      </View>

      {verificationStatus === 'pending' && (
        <View style={styles.pendingInfo}>
          <Text style={styles.pendingTitle}>⏳ What happens next?</Text>
          <Text style={styles.pendingText}>
            Our admin team will review your submitted documents within 1-3 business days.
            You'll receive a notification once the review is complete.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  infoSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  pendingInfo: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  pendingText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
});