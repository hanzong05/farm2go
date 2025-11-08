import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useCustomAlert } from './CustomAlert';

interface FloatingContactButtonProps {
  userId?: string;
  userType?: 'farmer' | 'buyer' | 'admin' | 'customer';
  buttonText?: string;
  buttonIcon?: keyof typeof Ionicons.glyphMap;
  position?: {
    bottom?: number;
    right?: number;
    left?: number;
    top?: number;
  };
  recipientId?: string | null;
  recipientType?: 'admin' | 'support' | 'custom';
  onSuccess?: () => void;
  onError?: (error: any) => void;
  visible?: boolean;
}

const colors = {
  primary: '#059669',
  white: '#ffffff',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  danger: '#ef4444',
  success: '#10b981',
};

export default function FloatingContactButton({
  userId,
  userType = 'buyer',
  buttonText = 'Contact Admin',
  buttonIcon = 'chatbubble-ellipses',
  position = { bottom: 24, right: 24 },
  recipientId = null,
  recipientType = 'admin',
  onSuccess,
  onError,
  visible = true,
}: FloatingContactButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const insets = useSafeAreaInsets();

  const { showAlert, AlertComponent } = useCustomAlert();

  if (!visible) return null;

  // Calculate safe position with insets
  const safePosition = {
    ...position,
    bottom: position.bottom !== undefined ? position.bottom + insets.bottom : undefined,
    right: position.right !== undefined ? position.right + insets.right : undefined,
    left: position.left !== undefined ? position.left + insets.left : undefined,
    top: position.top !== undefined ? position.top + insets.top : undefined,
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !subject.trim()) {
      showAlert('Validation Error', 'Please fill in both subject and message', [
        { text: 'OK', style: 'default' }
      ]);
      return;
    }

    if (!userId) {
      showAlert('Error', 'You must be logged in to send a message', [
        { text: 'OK', style: 'default' }
      ]);
      return;
    }

    setSending(true);
    try {
      // Create a conversation with admin
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: userId,
          recipient_id: recipientId,
          subject: subject.trim(),
          content: message.trim(),
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      showAlert('Success', 'Message sent successfully! An admin will respond soon.', [
        { text: 'OK', style: 'default' }
      ]);
      setMessage('');
      setSubject('');
      setShowModal(false);

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error sending message:', error);
      showAlert('Error', 'Failed to send message. Please try again.', [
        { text: 'OK', style: 'default' }
      ]);
      if (onError) onError(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.floatingButton, safePosition]}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name={buttonIcon} size={24} color={colors.white} />
        <Text style={styles.floatingButtonText}>{buttonText}</Text>
      </TouchableOpacity>

      {AlertComponent}

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact Admin</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="Enter subject"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.label}>Message</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Type your message here..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.sendButton, sending && styles.disabledButton]}
                  onPress={handleSendMessage}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.sendButtonText}>Send Message</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.4)',
        cursor: 'pointer',
      },
      default: {
        elevation: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
    }),
    zIndex: 9999,
  },

  floatingButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
      },
      default: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },

  modalBody: {
    padding: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 16,
    backgroundColor: colors.white,
  },

  textArea: {
    minHeight: 120,
    paddingTop: 10,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },

  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  sendButton: {
    backgroundColor: colors.primary,
  },

  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  disabledButton: {
    opacity: 0.6,
  },
});
