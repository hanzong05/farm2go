import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { locationService, BarangayResult } from '../services/locationService';

const { width } = Dimensions.get('window');

interface LocationPickerProps {
  onLocationSelect: (barangay: string) => void;
  initialBarangay?: string;
  focusedInput?: string | null;
  setFocusedInput?: (input: string | null) => void;
}

export default function LocationPicker({
  onLocationSelect,
  initialBarangay = '',
  focusedInput,
  setFocusedInput
}: LocationPickerProps) {
  const [barangay, setBarangay] = useState(initialBarangay);
  const [allBarangays, setAllBarangays] = useState<BarangayResult[]>([]);
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [loadingBarangay, setLoadingBarangay] = useState(false);

  const loadAllBarangays = useCallback(async () => {
    if (allBarangays.length > 0) return;

    setLoadingBarangay(true);
    console.log('🔍 Loading all barangays');

    try {
      const results = await locationService.getAllBarangays();
      console.log('📡 API returned:', results.length, 'barangay results');
      setAllBarangays(results);

      if (results.length > 0) {
        console.log('✅ Using API data');
      } else {
        console.log('⚠️ No results found');
      }
    } catch (error) {
      console.error('❌ API error:', error);
      setAllBarangays([]);
    } finally {
      setLoadingBarangay(false);
    }
  }, [allBarangays.length]);


  const handleBarangaySelect = useCallback((selectedBarangay: BarangayResult) => {
    setBarangay(selectedBarangay.name);
    setShowBarangayModal(false);
    onLocationSelect(selectedBarangay.name);
    setFocusedInput?.(null);
  }, [onLocationSelect, setFocusedInput]);



  const handleBarangayPress = () => {
    setFocusedInput?.('barangay');
    loadAllBarangays();
    setShowBarangayModal(true);
  };


  // Load all barangays on component mount
  useEffect(() => {
    loadAllBarangays();
  }, [loadAllBarangays]);

  return (
    <View style={styles.container}>
      {/* Barangay Dropdown */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          Barangay <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={[
            styles.inputWrapper,
            focusedInput === 'barangay' && styles.inputWrapperFocused,
            barangay && styles.inputWrapperFilled
          ]}
          onPress={handleBarangayPress}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.input,
            !barangay && styles.placeholder
          ]}>
            {barangay || "Select barangay in Tarlac City"}
          </Text>
          <View style={styles.dropdownIcon}>
            {loadingBarangay ? (
              <ActivityIndicator size="small" color="#10b981" />
            ) : (
              <Text style={styles.dropdownArrow}>▼</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>


      {/* Barangay Selection Modal */}
      <Modal
        visible={showBarangayModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBarangayModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBarangayModal(false)}
        >
          <View style={[styles.modalContent, { top: 200 }]}>
            <Text style={styles.modalTitle}>Select Barangay</Text>
            <ScrollView style={styles.modalList}>
              {allBarangays.length > 0 ? (
                allBarangays.map((barangayResult, index) => (
                  <TouchableOpacity
                    key={barangayResult.placeId || `barangay-${index}`}
                    style={[
                      styles.modalItem,
                      index === allBarangays.length - 1 && styles.lastModalItem
                    ]}
                    onPress={() => handleBarangaySelect(barangayResult)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalItemMain}>
                      {barangayResult.name}
                    </Text>
                    <Text style={styles.modalItemSecondary}>
                      Tarlac City, Tarlac
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    {loadingBarangay ? 'Loading barangays...' : 'No barangays available'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#dc2626',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapperFocused: {
    borderColor: '#10b981',
  },
  inputWrapperFilled: {
    borderColor: '#9ca3af',
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    minHeight: 48,
  },
  placeholder: {
    color: '#9ca3af',
  },
  disabledText: {
    color: '#9ca3af',
  },
  dropdownIcon: {
    paddingRight: 16,
    justifyContent: 'center',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  loadingIndicator: {
    paddingRight: 16,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    maxHeight: 300,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalList: {
    maxHeight: 240,
  },
  modalItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  lastModalItem: {
    borderBottomWidth: 0,
  },
  modalItemMain: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  modalItemSecondary: {
    fontSize: 14,
    color: '#6b7280',
  },
});