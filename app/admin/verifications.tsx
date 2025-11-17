import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import Icon from 'react-native-vector-icons/FontAwesome5';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useCustomAlert } from '../../components/CustomAlert';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { notifyAllAdmins, notifyUserAction } from '../../services/notifications';
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
  const [imageViewModal, setImageViewModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{url: string, title: string} | null>(null);
  const [viewModal, setViewModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<VerificationSubmission | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editData, setEditData] = useState<{notes: string; status: string} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    isDestructive: boolean;
    confirmText: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    isDestructive: false,
    confirmText: '',
    onConfirm: () => {},
  });

  const { showAlert, AlertComponent } = useCustomAlert();

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
      await loadVerificationSubmissions(userData.profile);
    } catch (error) {
      console.error('Error loading data:', error);
      showAlert('Error', 'Failed to load verification submissions', [
        { text: 'OK', style: 'default' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadVerificationSubmissions = async (adminProfile?: Profile) => {
    try {
      const currentProfile = adminProfile || profile;

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

      // Filter submissions to only show users from the same barangay as the admin
      const filteredData = (data || []).filter(submission =>
        submission.user_profile?.barangay === currentProfile?.barangay
      );

      setSubmissions(filteredData);
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

  const openViewModal = (submission: VerificationSubmission) => {
    setSelectedSubmission(submission);
    setViewModal(true);
  };

  const closeViewModal = () => {
    setViewModal(false);
    setSelectedSubmission(null);
  };

  const openEditModal = (submission: VerificationSubmission) => {
    setSelectedSubmission(submission);
    setEditData({
      notes: submission.admin_notes || '',
      status: submission.status,
    });
    setEditModal(true);
  };

  const closeEditModal = () => {
    setEditModal(false);
    setSelectedSubmission(null);
    setEditData(null);
  };

  const handleUpdate = async () => {
    if (!selectedSubmission || !editData || !profile) return;

    try {
      setProcessing(true);

      const { error: submissionError } = await supabase
        .from('verification_submissions')
        .update({
          status: editData.status as 'pending' | 'approved' | 'rejected',
          admin_notes: editData.notes || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile.id,
        })
        .eq('id', selectedSubmission.id);

      if (submissionError) throw submissionError;

      // Update profile table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          verification_status: editData.status,
          verification_admin_notes: editData.notes || null,
          ...(editData.status === 'approved' ? {
            verification_approved_at: new Date().toISOString(),
            verification_rejected_at: null,
          } : {}),
          ...(editData.status === 'rejected' ? {
            verification_rejected_at: new Date().toISOString(),
            verification_approved_at: null,
          } : {}),
        })
        .eq('id', selectedSubmission.user_id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      showAlert('Success', 'Verification updated successfully', [
        { text: 'OK', style: 'default' }
      ]);
      await loadVerificationSubmissions();
      closeEditModal();
    } catch (error) {
      console.error('Error updating verification:', error);
      showAlert('Error', 'Failed to update verification', [
        { text: 'OK', style: 'default' }
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = (submission: VerificationSubmission) => {
    const userName = `${submission.user_profile?.first_name} ${submission.user_profile?.last_name}`;

    setConfirmModal({
      visible: true,
      title: 'Delete Verification?',
      message: `Are you sure you want to delete ${userName}'s verification submission? This action cannot be undone.`,
      isDestructive: true,
      confirmText: 'Yes, Delete',
      onConfirm: async () => {
        try {
          setProcessing(true);

          const { error } = await supabase
            .from('verification_submissions')
            .delete()
            .eq('id', submission.id);

          if (error) throw error;

          showAlert('Success', 'Verification deleted successfully', [
            { text: 'OK', style: 'default' }
          ]);
          await loadVerificationSubmissions();
          setConfirmModal(prev => ({ ...prev, visible: false }));
        } catch (error) {
          console.error('Error deleting verification:', error);
          showAlert('Error', 'Failed to delete verification', [
            { text: 'OK', style: 'default' }
          ]);
        } finally {
          setProcessing(false);
        }
      }
    });
  };

  const openReviewModal = (submission: VerificationSubmission, action: 'approve' | 'reject') => {
    const userName = `${submission.user_profile?.first_name} ${submission.user_profile?.last_name}`;
    const isApproval = action === 'approve';

    setConfirmModal({
      visible: true,
      title: `${isApproval ? 'Approve' : 'Reject'} Verification?`,
      message: `Are you sure you want to ${action} ${userName}'s verification?`,
      isDestructive: !isApproval,
      confirmText: `Yes, ${action}`,
      onConfirm: () => {
        setReviewModalData({ submission, action });
        setAdminNotes('');
        setShowReviewModal(true);
        setConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const openImageViewer = (imageUrl: string, title: string) => {
    setSelectedImage({ url: imageUrl, title });
    setImageViewModal(true);
  };

  const closeImageViewer = () => {
    setImageViewModal(false);
    setSelectedImage(null);
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

      const { error: submissionError } = await supabase
        .from('verification_submissions')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile.id,
          admin_notes: adminNotes || null,
        })
        .eq('id', submission.id);

      if (submissionError) throw submissionError;

      if (action === 'approve') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            verification_status: 'approved',
            verification_approved_at: new Date().toISOString(),
            verification_rejected_at: null,
            verification_admin_notes: adminNotes || null,
            id_document_url: submission.id_document_url,
            face_photo_url: submission.face_photo_url,
            id_document_type: submission.id_document_type
          })
          .eq('id', submission.user_id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      } else if (action === 'reject') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            verification_status: 'rejected',
            verification_rejected_at: new Date().toISOString(),
            verification_approved_at: null,
            verification_admin_notes: adminNotes || null
          })
          .eq('id', submission.user_id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }

      try {
        const userName = `${submission.user_profile?.first_name} ${submission.user_profile?.last_name}`;

        await notifyUserAction(
          submission.user_id,
          action === 'approve' ? 'approved' : 'rejected',
          'verification',
          'verification documents',
          profile.id,
          adminNotes || `Verification ${action === 'approve' ? 'approved' : 'rejected'} by administrator`
        );

        await notifyAllAdmins(
          `Verification ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          `Admin ${profile.first_name} ${profile.last_name} ${action === 'approve' ? 'approved' : 'rejected'} the verification for ${userName} (${submission.user_profile?.email})`,
          profile.id,
          {
            action: `verification_${action === 'approve' ? 'approved' : 'rejected'}`,
            userName: userName,
            userEmail: submission.user_profile?.email,
            userType: submission.user_profile?.user_type,
            adminNotes: adminNotes
          }
        );

        console.log('✅ Notifications sent for verification action');
      } catch (notifError) {
        console.error('⚠️ Failed to send notifications:', notifError);
      }

      showAlert(
        'Success!',
        `Verification ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
        [{ text: 'OK', style: 'default', onPress: () => closeReviewModal() }]
      );

      await loadVerificationSubmissions();
    } catch (error) {
      console.error('Error processing verification:', error);

      let errorMessage = 'Failed to process verification. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'You do not have permission to perform this action.';
        }
      }

      showAlert('Error', errorMessage, [
        { text: 'OK', style: 'default' }
      ]);
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
        showMessages={true}
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
        horizontal
        style={styles.scrollView}
        contentContainerStyle={styles.tableContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
      >
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colName]}>Name</Text>
            <Text style={[styles.tableHeaderText, styles.colEmail]}>Email</Text>
            <Text style={[styles.tableHeaderText, styles.colType]}>User Type</Text>
            <Text style={[styles.tableHeaderText, styles.colBarangay]}>Barangay</Text>
            <Text style={[styles.tableHeaderText, styles.colDocType]}>Doc Type</Text>
            <Text style={[styles.tableHeaderText, styles.colStatus]}>Status</Text>
            <Text style={[styles.tableHeaderText, styles.colDate]}>Submitted</Text>
            <Text style={[styles.tableHeaderText, styles.colActions]}>Actions</Text>
          </View>

          {/* Table Body */}
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
            filteredSubmissions.map((submission, index) => (
              <View key={submission.id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                <Text style={[styles.tableCell, styles.colName]}>
                  {submission.user_profile?.first_name} {submission.user_profile?.last_name}
                </Text>
                <Text style={[styles.tableCell, styles.colEmail]}>
                  {submission.user_profile?.email}
                </Text>
                <Text style={[styles.tableCell, styles.colType]}>
                  {submission.user_profile?.user_type?.toUpperCase()}
                </Text>
                <Text style={[styles.tableCell, styles.colBarangay]}>
                  {submission.user_profile?.barangay || 'N/A'}
                </Text>
                <Text style={[styles.tableCell, styles.colDocType]}>
                  {submission.id_document_type.replace('_', ' ').toUpperCase()}
                </Text>
                <View style={[styles.tableCell, styles.colStatus]}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(submission.status) }]}>
                    <Text style={styles.statusText}>{submission.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={[styles.tableCell, styles.colDate]}>
                  {formatDate(submission.submitted_at)}
                </Text>
                <View style={[styles.tableCell, styles.colActions, styles.actionButtons]}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.viewBtn]}
                    onPress={() => openViewModal(submission)}
                  >
                    <Icon name="eye" size={14} color="#1e40af" />
                  </TouchableOpacity>
                  {submission.status === 'pending' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.editBtn]}
                        onPress={() => openEditModal(submission)}
                      >
                        <Icon name="edit" size={14} color="#ca8a04" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => openReviewModal(submission, 'approve')}
                      >
                        <Icon name="check" size={14} color="#ffffff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => openReviewModal(submission, 'reject')}
                      >
                        <Icon name="times" size={14} color="#ffffff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={() => handleDelete(submission)}
                      >
                        <Icon name="trash" size={14} color="#ffffff" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.editBtn]}
                        onPress={() => openEditModal(submission)}
                      >
                        <Icon name="edit" size={14} color="#ca8a04" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={() => handleDelete(submission)}
                      >
                        <Icon name="trash" size={14} color="#ffffff" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* View Modal */}
      <Modal
        visible={viewModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeViewModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>View Verification Details</Text>
              <TouchableOpacity onPress={closeViewModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedSubmission && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name:</Text>
                    <Text style={styles.detailValue}>
                      {selectedSubmission.user_profile?.first_name} {selectedSubmission.user_profile?.last_name}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Email:</Text>
                    <Text style={styles.detailValue}>{selectedSubmission.user_profile?.email}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>User Type:</Text>
                    <Text style={styles.detailValue}>
                      {selectedSubmission.user_profile?.user_type?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Barangay:</Text>
                    <Text style={styles.detailValue}>{selectedSubmission.user_profile?.barangay}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Document Type:</Text>
                    <Text style={styles.detailValue}>
                      {selectedSubmission.id_document_type.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedSubmission.status) }]}>
                      <Text style={styles.statusText}>{selectedSubmission.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Submitted:</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedSubmission.submitted_at)}</Text>
                  </View>
                  {selectedSubmission.submission_notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>User Notes:</Text>
                      <Text style={styles.detailValue}>{selectedSubmission.submission_notes}</Text>
                    </View>
                  )}
                  {selectedSubmission.admin_notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Admin Notes:</Text>
                      <Text style={styles.detailValue}>{selectedSubmission.admin_notes}</Text>
                    </View>
                  )}

                  <Text style={styles.documentsTitle}>Documents</Text>
                  <View style={styles.modalDocuments}>
                    <TouchableOpacity onPress={() => {
                      const idDocUrl = supabase.storage
                        .from('verification-documents')
                        .getPublicUrl(selectedSubmission.id_document_url).data.publicUrl;
                      openImageViewer(idDocUrl, 'ID Document');
                    }}>
                      <Image
                        source={{
                          uri: supabase.storage
                            .from('verification-documents')
                            .getPublicUrl(selectedSubmission.id_document_url).data.publicUrl
                        }}
                        style={styles.modalDocImage}
                        resizeMode="cover"
                      />
                      <Text style={styles.modalImageLabel}>ID Document (Tap to enlarge)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      const facePhotoUrl = supabase.storage
                        .from('verification-documents')
                        .getPublicUrl(selectedSubmission.face_photo_url).data.publicUrl;
                      openImageViewer(facePhotoUrl, 'Face Photo');
                    }}>
                      <Image
                        source={{
                          uri: supabase.storage
                            .from('verification-documents')
                            .getPublicUrl(selectedSubmission.face_photo_url).data.publicUrl
                        }}
                        style={styles.modalDocImage}
                        resizeMode="cover"
                      />
                      <Text style={styles.modalImageLabel}>Face Photo (Tap to enlarge)</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Verification</Text>
              <TouchableOpacity onPress={closeEditModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedSubmission && editData && (
                <>
                  <Text style={styles.modalUserName}>
                    {selectedSubmission.user_profile?.first_name} {selectedSubmission.user_profile?.last_name}
                  </Text>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Status:</Text>
                    <View style={styles.statusOptions}>
                      {['pending', 'approved', 'rejected'].map((status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusOption,
                            editData.status === status && styles.statusOptionActive,
                            { borderColor: getStatusColor(status) }
                          ]}
                          onPress={() => setEditData({ ...editData, status })}
                        >
                          <Text style={[
                            styles.statusOptionText,
                            editData.status === status && { color: getStatusColor(status) }
                          ]}>
                            {status.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Admin Notes:</Text>
                    <TextInput
                      style={styles.textArea}
                      multiline
                      numberOfLines={4}
                      placeholder="Add notes..."
                      value={editData.notes}
                      onChangeText={(text) => setEditData({ ...editData, notes: text })}
                    />
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={closeEditModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleUpdate}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Admin Notes (Optional):</Text>
                    <TextInput
                      style={styles.textArea}
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
              <TouchableOpacity style={styles.modalCancelButton} onPress={closeReviewModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  reviewModalData?.action === 'approve' ? styles.modalApproveButton : styles.modalRejectButton
                ]}
                onPress={processVerification}
                disabled={processing}
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

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewModal}
        animationType="fade"
        transparent={true}
        onRequestClose={closeImageViewer}
      >
        <View style={styles.imageViewerOverlay}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>{selectedImage?.title}</Text>
            <TouchableOpacity onPress={closeImageViewer} style={styles.imageViewerCloseButton}>
              <Text style={styles.imageViewerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.imageViewerContent}
            contentContainerStyle={styles.imageViewerContentContainer}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            {selectedImage && (
              <Image
                source={{ uri: selectedImage.url }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>

          <TouchableOpacity style={styles.imageViewerCloseArea} onPress={closeImageViewer}>
            <Text style={styles.imageViewerCloseHint}>Tap anywhere to close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <ConfirmationModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />

      {AlertComponent}
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
  tableContainer: {
    padding: 20,
  },
  table: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  colName: {
    width: 150,
  },
  colEmail: {
    width: 200,
  },
  colType: {
    width: 100,
  },
  colBarangay: {
    width: 120,
  },
  colDocType: {
    width: 120,
  },
  colStatus: {
    width: 100,
    alignItems: 'center',
  },
  colDate: {
    width: 150,
  },
  colActions: {
    width: 200,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewBtn: {
    backgroundColor: '#dbeafe',
  },
  editBtn: {
    backgroundColor: '#fef3c7',
  },
  approveBtn: {
    backgroundColor: '#10b981',
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
  },
  deleteBtn: {
    backgroundColor: '#dc2626',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
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
    marginBottom: 20,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  documentsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 20,
    marginBottom: 12,
  },
  modalDocuments: {
    flexDirection: 'row',
    gap: 12,
  },
  modalDocImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalImageLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  statusOptionActive: {
    backgroundColor: '#f9fafb',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
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
    backgroundColor: '#3b82f6',
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

  // Image Viewer Modal
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  imageViewerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  imageViewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  imageViewerContent: {
    flex: 1,
  },
  imageViewerContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width,
    height: '100%',
  },
  imageViewerCloseArea: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  imageViewerCloseHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
});
