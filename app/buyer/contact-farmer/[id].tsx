import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface FarmerProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  farm_name: string | null;
  farm_location: string | null;
  farm_size: string | null;
  crop_types: string | null;
}

export default function ContactFarmerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [farmer, setFarmer] = useState<FarmerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [message, setMessage] = useState({
    subject: '',
    content: '',
  });

  useEffect(() => {
    if (id) {
      fetchFarmer();
    }
  }, [id]);

  const fetchFarmer = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .eq('user_type', 'farmer')
        .single();

      if (error) {
        console.error('Error fetching farmer:', error);
        setError('Failed to load farmer information');
        return;
      }

      setFarmer(data);
    } catch (err) {
      console.error('Farmer fetch error:', err);
      setError('An error occurred while loading farmer information');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!farmer || !user) return;

    if (!message.subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }

    if (!message.content.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    try {
      setSending(true);

      // Create message record
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: farmer.id,
          subject: message.subject.trim(),
          content: message.content.trim(),
          status: 'unread',
        });

      if (messageError) {
        console.error('Error sending message:', messageError);
        Alert.alert('Error', 'Failed to send message. Please try again.');
        return;
      }

      Alert.alert(
        'Message Sent!',
        `Your message has been sent to ${farmer.first_name} ${farmer.last_name}. They will be notified and can respond to you directly.`,
        [
          {
            text: 'Send Another',
            onPress: () => {
              setMessage({ subject: '', content: '' });
            },
          },
          {
            text: 'Back to Marketplace',
            onPress: () => router.push('/buyer/marketplace'),
            style: 'cancel',
          },
        ]
      );
    } catch (err) {
      console.error('Send message error:', err);
      Alert.alert('Error', 'An error occurred while sending the message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading farmer information...</Text>
      </View>
    );
  }

  if (error || !farmer) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Farmer not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Contact Farmer</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Farmer Information */}
        <View style={styles.farmerInfo}>
          <Text style={styles.sectionTitle}>Farmer Information</Text>

          <Text style={styles.farmerName}>
            {farmer.first_name} {farmer.last_name}
          </Text>

          {farmer.farm_name && (
            <Text style={styles.farmName}>{farmer.farm_name}</Text>
          )}

          {farmer.farm_location && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Location:</Text>
              <Text style={styles.infoValue}>{farmer.farm_location}</Text>
            </View>
          )}

          {farmer.farm_size && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Farm Size:</Text>
              <Text style={styles.infoValue}>{farmer.farm_size}</Text>
            </View>
          )}

          {farmer.crop_types && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Specializes in:</Text>
              <Text style={styles.infoValue}>{farmer.crop_types}</Text>
            </View>
          )}

          {farmer.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{farmer.phone}</Text>
            </View>
          )}
        </View>

        {/* Message Form */}
        <View style={styles.messageForm}>
          <Text style={styles.sectionTitle}>Send Message</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Subject <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={message.subject}
              onChangeText={(text) => setMessage({ ...message, subject: text })}
              placeholder="Enter message subject"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Message <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message.content}
              onChangeText={(text) => setMessage({ ...message, content: text })}
              placeholder="Type your message here..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={6}
            />
          </View>

          <Text style={styles.disclaimer}>
            Your contact information will be shared with the farmer so they can respond to your inquiry.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={sending}
        >
          <Text style={styles.sendButtonText}>
            {sending ? 'Sending...' : 'Send Message'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  farmerInfo: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  farmerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  farmName: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  messageForm: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#dc2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  disclaimer: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  sendButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});