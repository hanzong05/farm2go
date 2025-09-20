import { router } from 'expo-router';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface VerificationStatusProps {
  verificationStatus: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  userType: 'farmer' | 'buyer';
  onVerificationPress?: () => void;
  showAction?: boolean;
}

export default function VerificationStatus({
  verificationStatus,
  userType,
  onVerificationPress,
  showAction = true,
}: VerificationStatusProps) {
  const getStatusConfig = () => {
    switch (verificationStatus) {
      case 'not_submitted':
        return {
          icon: '⚠️',
          title: 'Verification Required',
          description: `Complete identity verification to ${userType === 'farmer' ? 'sell products' : 'purchase products'}`,
          backgroundColor: '#fef3c7',
          borderColor: '#f59e0b',
          textColor: '#92400e',
          actionText: 'Start Verification',
          actionColor: '#f59e0b',
        };
      case 'pending':
        return {
          icon: '⏳',
          title: 'Verification Pending',
          description: 'Your verification is being reviewed by our admin team',
          backgroundColor: '#dbeafe',
          borderColor: '#3b82f6',
          textColor: '#1e40af',
          actionText: 'View Status',
          actionColor: '#3b82f6',
        };
      case 'approved':
        return {
          icon: '✅',
          title: 'Verification Approved',
          description: `You can now ${userType === 'farmer' ? 'sell products' : 'purchase products'}`,
          backgroundColor: '#ecfdf5',
          borderColor: '#10b981',
          textColor: '#065f46',
          actionText: 'View Certificate',
          actionColor: '#10b981',
        };
      case 'rejected':
        return {
          icon: '❌',
          title: 'Verification Rejected',
          description: 'Your verification was rejected. Please submit new documents',
          backgroundColor: '#fef2f2',
          borderColor: '#dc2626',
          textColor: '#991b1b',
          actionText: 'Resubmit',
          actionColor: '#dc2626',
        };
      default:
        return {
          icon: '❓',
          title: 'Unknown Status',
          description: 'Please contact support',
          backgroundColor: '#f3f4f6',
          borderColor: '#6b7280',
          textColor: '#374151',
          actionText: 'Contact Support',
          actionColor: '#6b7280',
        };
    }
  };

  const handleActionPress = () => {
    if (onVerificationPress) {
      onVerificationPress();
    } else {
      // Default navigation based on status
      switch (verificationStatus) {
        case 'not_submitted':
        case 'rejected':
          router.push('/verification/upload');
          break;
        case 'pending':
          router.push('/verification/status');
          break;
        case 'approved':
          router.push('/verification/certificate');
          break;
      }
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor,
      }
    ]}>
      <View style={styles.content}>
        <Text style={styles.icon}>{config.icon}</Text>
        <View style={styles.textContent}>
          <Text style={[styles.title, { color: config.textColor }]}>
            {config.title}
          </Text>
          <Text style={[styles.description, { color: config.textColor }]}>
            {config.description}
          </Text>
        </View>
      </View>

      {showAction && (
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: config.actionColor }]}
          onPress={handleActionPress}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionText, { color: config.actionColor }]}>
            {config.actionText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});