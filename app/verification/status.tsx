import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import HeaderComponent from '../../components/HeaderComponent';
import VerificationStatus from '../../components/VerificationStatus';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

type Profile = Database['public']['Tables']['profiles']['Row'];

interface VerificationData {
  verification_status: string;
  verification_submitted_at: string | null;
  verification_approved_at: string | null;
  verification_rejected_at: string | null;
  verification_admin_notes: string | null;
  id_document_url: string | null;
  face_photo_url: string | null;
  id_document_type: string | null;
}

export default function VerificationStatusScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        router.replace('/auth/login');
        return;
      }

      setProfile(userData.profile);
      await loadVerificationData(userData.user.id);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load verification status');
    } finally {
      setLoading(false);
    }
  };

  const loadVerificationData = async (userId: string) => {
    try {
      // Get the latest verification submission for accurate data
      const { data, error } = await supabase
        .from('verification_submissions')
        .select(`
          status,
          submitted_at,
          reviewed_at,
          admin_notes,
          id_document_url,
          face_photo_url,
          id_document_type
        `)
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const submission = data[0];
        // Map verification_submissions fields to the expected format
        setVerificationData({
          verification_status: submission.status,
          verification_submitted_at: submission.submitted_at,
          verification_approved_at: submission.status === 'approved' ? submission.reviewed_at : null,
          verification_rejected_at: submission.status === 'rejected' ? submission.reviewed_at : null,
          verification_admin_notes: submission.admin_notes,
          id_document_url: submission.id_document_url,
          face_photo_url: submission.face_photo_url,
          id_document_type: submission.id_document_type,
        });
      } else {
        // No verification submission found
        setVerificationData({
          verification_status: 'not_submitted',
          verification_submitted_at: null,
          verification_approved_at: null,
          verification_rejected_at: null,
          verification_admin_notes: null,
          id_document_url: null,
          face_photo_url: null,
          id_document_type: null,
        });
      }
    } catch (error) {
      console.error('Error loading verification data:', error);
      throw error;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleResubmit = () => {
    router.push('/verification/upload');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDocumentTypeLabel = (type: string | null) => {
    const types: { [key: string]: string } = {
      drivers_license: 'Driver\'s License',
      national_id: 'National ID',
      passport: 'Passport',
      voters_id: 'Voter\'s ID',
      postal_id: 'Postal ID',
    };
    return type ? types[type] || type : 'Unknown';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading verification status...</Text>
      </View>
    );
  }

  if (!profile || !verificationData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Unable to load verification status</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType={profile.user_type as any}
        currentRoute="/verification/status"
        showMessages={false}
        showNotifications={true}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Verification Status</Text>
          <Text style={styles.subtitle}>
            Track your identity verification progress
          </Text>
        </View>

        {/* Current Status */}
        <VerificationStatus
          verificationStatus={verificationData.verification_status as any}
          userType={profile.user_type as any}
          onVerificationPress={verificationData.verification_status === 'rejected' ? handleResubmit : undefined}
        />

        {/* Verification Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Verification Details</Text>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={[
                styles.detailValue,
                { color: getStatusColor(verificationData.verification_status) }
              ]}>
                {verificationData.verification_status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>

            {verificationData.verification_submitted_at && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Submitted:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(verificationData.verification_submitted_at)}
                </Text>
              </View>
            )}

            {verificationData.verification_approved_at && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Approved:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(verificationData.verification_approved_at)}
                </Text>
              </View>
            )}

            {verificationData.verification_rejected_at && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Rejected:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(verificationData.verification_rejected_at)}
                </Text>
              </View>
            )}

            {verificationData.id_document_type && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>ID Document Type:</Text>
                <Text style={styles.detailValue}>
                  {getDocumentTypeLabel(verificationData.id_document_type)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Admin Notes */}
        {verificationData.verification_admin_notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Admin Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>
                {verificationData.verification_admin_notes}
              </Text>
            </View>
          </View>
        )}

        {/* Documents Preview */}
        {(verificationData.id_document_url || verificationData.face_photo_url) && (
          <View style={styles.documentsSection}>
            <Text style={styles.sectionTitle}>Submitted Documents</Text>
            <View style={styles.documentsCard}>
              <View style={styles.documentsRow}>
                {verificationData.id_document_url && (
                  <View style={styles.documentPreview}>
                    <Image
                      source={{ uri: verificationData.id_document_url }}
                      style={styles.documentImage}
                    />
                    <Text style={styles.documentLabel}>ID Document</Text>
                  </View>
                )}
                {verificationData.face_photo_url && (
                  <View style={styles.documentPreview}>
                    <Image
                      source={{ uri: verificationData.face_photo_url }}
                      style={styles.faceImage}
                    />
                    <Text style={styles.documentLabel}>Face Photo</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {verificationData.verification_status === 'rejected' && (
            <TouchableOpacity
              style={styles.resubmitButton}
              onPress={handleResubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.resubmitButtonText}>Resubmit Verification</Text>
            </TouchableOpacity>
          )}

          {verificationData.verification_status === 'not_submitted' && (
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => router.push('/verification/upload')}
              activeOpacity={0.8}
            >
              <Text style={styles.startButtonText}>Start Verification</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            If you have questions about the verification process or need assistance,
            please contact our support team.
          </Text>
          <TouchableOpacity style={styles.helpButton} activeOpacity={0.8}>
            <Text style={styles.helpButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  function getStatusColor(status: string) {
    switch (status) {
      case 'approved': return '#10b981';
      case 'rejected': return '#dc2626';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
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
  detailsSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  notesSection: {
    marginBottom: 24,
  },
  notesCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  notesText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  documentsSection: {
    marginBottom: 24,
  },
  documentsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  documentsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  documentPreview: {
    flex: 1,
    alignItems: 'center',
  },
  documentImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  faceImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  documentLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  actionSection: {
    marginBottom: 32,
  },
  resubmitButton: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  resubmitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  helpButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  helpButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});