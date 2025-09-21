import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

type Profile = Database['public']['Tables']['profiles']['Row'];

interface VerificationSubmission {
  id: string;
  user_id: string;
  id_document_url: string;
  face_photo_url: string;
  id_document_type: string;
  submission_notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_notes: string | null;
  user_profile: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    user_type: 'farmer' | 'buyer';
    barangay: string | null;
    farm_name: string | null;
  };
}

interface ReviewModalData {
  submission: VerificationSubmission;
  action: 'approve' | 'reject';
}

export default function AdminVerificationsScreen() {
  const [submissions, setSubmissions] = useState<VerificationSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<VerificationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewModalData, setReviewModalData] = useState<ReviewModalData | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const STATUS_OPTIONS = [
    { key: 'all', label: 'All', color: '#6b7280' },
    { key: 'pending', label: 'Pending', color: '#f59e0b' },
    { key: 'approved', label: 'Approved', color: '#10b981' },
    { key: 'rejected', label: 'Rejected', color: '#dc2626' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [submissions, selectedStatus]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile || userData.profile.user_type !== 'admin') {
        router.replace('/auth/login');
        return;
      }

      setProfile(userData.profile);
      await loadVerificationSubmissions();
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load verification submissions');
    } finally {
      setLoading(false);
    }
  };

  const loadVerificationSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('verification_submissions')
        .select(`
          *,
          user_profile:user_id (
            first_name,
            last_name,
            email,
            user_type,
            barangay,
            farm_name
          )
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      setSubmissions(data || []);
    } catch (error) {
      console.error('Error loading verification submissions:', error);
      throw error;
    }
  };

  const filterSubmissions = () => {
    if (selectedStatus === 'all') {
      setFilteredSubmissions(submissions);
    } else {
      setFilteredSubmissions(submissions.filter(sub => sub.status === selectedStatus));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadVerificationSubmissions();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const openReviewModal = (submission: VerificationSubmission, action: 'approve' | 'reject') => {
    setReviewModalData({ submission, action });
    setAdminNotes('');
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setReviewModalData(null);
    setAdminNotes('');
  };

  const processVerification = async () => {
    if (!reviewModalData || !profile) return;

    const { submission, action } = reviewModalData;

    try {
      setProcessing(true);

      const { error } = await (supabase as any)
        .from('verification_submissions')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile.id,
          admin_notes: adminNotes || null,
        })
        .eq('id', submission.id);

      if (error) throw error;

      Alert.alert(
        'Success',
        `Verification ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
        [{ text: 'OK', onPress: closeReviewModal }]
      );

      await loadVerificationSubmissions();
    } catch (error) {
      console.error('Error processing verification:', error);
      Alert.alert('Error', 'Failed to process verification. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'approved': return '#10b981';
      case 'rejected': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const renderSubmissionCard = (submission: VerificationSubmission) => (
    <View key={submission.id} style={styles.submissionCard}>
      <View style={styles.submissionHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {submission.user_profile?.first_name} {submission.user_profile?.last_name}
          </Text>
          <Text style={styles.userEmail}>{submission.user_profile?.email}</Text>
          <View style={styles.userBadge}>
            <Text style={styles.userBadgeText}>
              {submission.user_profile?.user_type?.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(submission.status) }]}>
          <Text style={styles.statusText}>{submission.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.submissionDetails}>
        <Text style={styles.detailLabel}>ID Document Type:</Text>
        <Text style={styles.detailValue}>
          {submission.id_document_type.replace('_', ' ').toUpperCase()}
        </Text>

        <Text style={styles.detailLabel}>Submitted:</Text>
        <Text style={styles.detailValue}>{formatDate(submission.submitted_at)}</Text>

        {submission.user_profile?.barangay && (
          <>
            <Text style={styles.detailLabel}>Location:</Text>
            <Text style={styles.detailValue}>{submission.user_profile.barangay}</Text>
          </>
        )}

        {submission.user_profile?.farm_name && (
          <>
            <Text style={styles.detailLabel}>Farm Name:</Text>
            <Text style={styles.detailValue}>{submission.user_profile.farm_name}</Text>
          </>
        )}

        {submission.submission_notes && (
          <>
            <Text style={styles.detailLabel}>User Notes:</Text>
            <Text style={styles.detailValue}>{submission.submission_notes}</Text>
          </>
        )}
      </View>

      <View style={styles.documentsSection}>
        <Text style={styles.documentsTitle}>Documents</Text>
        <View style={styles.documentsRow}>
          <View style={styles.documentPreview}>
            <Image source={{ uri: submission.id_document_url }} style={styles.documentImage} />
            <Text style={styles.documentLabel}>ID Document</Text>
          </View>
          <View style={styles.documentPreview}>
            <Image source={{ uri: submission.face_photo_url }} style={styles.faceImage} />
            <Text style={styles.documentLabel}>Face Photo</Text>
          </View>
        </View>
      </View>

      {submission.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => openReviewModal(submission, 'reject')}
            activeOpacity={0.8}
          >
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => openReviewModal(submission, 'approve')}
            activeOpacity={0.8}
          >
            <Text style={styles.approveButtonText}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}

      {submission.status !== 'pending' && submission.admin_notes && (
        <View style={styles.adminNotesSection}>
          <Text style={styles.adminNotesLabel}>Admin Notes:</Text>
          <Text style={styles.adminNotesText}>{submission.admin_notes}</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading verifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="admin"
        currentRoute="/admin/verifications"
        showMessages={false}
        showNotifications={true}
      />

      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>User Verifications</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {STATUS_OPTIONS.map((status) => (
            <TouchableOpacity
              key={status.key}
              style={[
                styles.filterButton,
                selectedStatus === status.key && [
                  styles.filterButtonActive,
                  { backgroundColor: status.color }
                ]
              ]}
              onPress={() => setSelectedStatus(status.key as any)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterButtonText,
                selectedStatus === status.key && styles.filterButtonTextActive
              ]}>
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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
        {filteredSubmissions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>No Verifications Found</Text>
            <Text style={styles.emptyDescription}>
              {selectedStatus === 'pending'
                ? 'No pending verifications at the moment.'
                : `No ${selectedStatus} verifications found.`}
            </Text>
          </View>
        ) : (
          <View style={styles.submissionsList}>
            {filteredSubmissions.map(renderSubmissionCard)}
          </View>
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeReviewModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {reviewModalData?.action === 'approve' ? 'Approve' : 'Reject'} Verification
              </Text>
              <TouchableOpacity onPress={closeReviewModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {reviewModalData && (
                <>
                  <Text style={styles.modalUserName}>
                    {reviewModalData.submission.user_profile?.first_name}{' '}
                    {reviewModalData.submission.user_profile?.last_name}
                  </Text>
                  <Text style={styles.modalUserType}>
                    {reviewModalData.submission.user_profile?.user_type?.toUpperCase()}
                  </Text>

                  <View style={styles.modalDocuments}>
                    <View style={styles.modalDocumentRow}>
                      <Image
                        source={{ uri: reviewModalData.submission.id_document_url }}
                        style={styles.modalDocumentImage}
                      />
                      <Image
                        source={{ uri: reviewModalData.submission.face_photo_url }}
                        style={styles.modalFaceImage}
                      />
                    </View>
                  </View>

                  <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>Admin Notes (Optional):</Text>
                    <TextInput
                      style={styles.notesInput}
                      multiline
                      numberOfLines={4}
                      placeholder={
                        reviewModalData.action === 'approve'
                          ? 'Add any notes about the approval...'
                          : 'Explain why this verification is being rejected...'
                      }
                      value={adminNotes}
                      onChangeText={setAdminNotes}
                    />
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeReviewModal}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  reviewModalData?.action === 'approve'
                    ? styles.modalApproveButton
                    : styles.modalRejectButton
                ]}
                onPress={processVerification}
                disabled={processing}
                activeOpacity={0.8}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {reviewModalData?.action === 'approve' ? 'Approve' : 'Reject'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  filterContainer: {
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterButtonActive: {
    borderColor: 'transparent',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  submissionsList: {
    gap: 16,
  },
  submissionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  userBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  userBadgeText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  submissionDetails: {
    marginBottom: 16,
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  detailValue: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  documentsSection: {
    marginBottom: 16,
  },
  documentsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#dc2626',
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  adminNotesSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  adminNotesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  adminNotesText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
    maxHeight: 400,
  },
  modalUserName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  modalUserType: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  modalDocuments: {
    marginBottom: 20,
  },
  modalDocumentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalDocumentImage: {
    flex: 1,
    height: 160,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  modalFaceImage: {
    flex: 1,
    height: 160,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  notesSection: {
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApproveButton: {
    backgroundColor: '#10b981',
  },
  modalRejectButton: {
    backgroundColor: '#dc2626',
  },
  modalConfirmText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
});