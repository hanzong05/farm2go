import React from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

interface InvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  order: {
    id: string;
    buyer_profile?: {
      first_name: string | null;
      last_name: string | null;
    };
    created_at: string;
    total_amount: number;
    proof_of_payment?: string | null;
    order_items?: Array<{
      quantity: number;
      unit_price: number;
      total_price: number;
      product: {
        name: string;
        unit: string;
      };
    }>;
  } | null;
  farmerProfile?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
  } | null;
}

export default function InvoiceModal({
  visible,
  onClose,
  order,
  farmerProfile,
}: InvoiceModalProps) {
  if (!order) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(price);
  };

  const calculateSubtotal = () => {
    return order.order_items?.reduce((sum, item) => sum + item.total_price, 0) || 0;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invoice</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="times" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Invoice Header */}
            <View style={styles.invoiceHeader}>
              <Text style={styles.invoiceTitle}>INVOICE</Text>
              <Text style={styles.invoiceNumber}>#{order.id.slice(-8).toUpperCase()}</Text>
              <Text style={styles.invoiceDate}>{formatDate(order.created_at)}</Text>
            </View>

            {/* From Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>From:</Text>
              <View style={styles.addressBox}>
                <Text style={styles.businessName}>
                  {farmerProfile?.farm_name ||
                   `${farmerProfile?.first_name || ''} ${farmerProfile?.last_name || ''}`.trim() ||
                   'Farm2Go Farmer'}
                </Text>
                <Text style={styles.addressText}>Farm2Go Agricultural Platform</Text>
              </View>
            </View>

            {/* To Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>To:</Text>
              <View style={styles.addressBox}>
                <Text style={styles.customerName}>
                  {`${order.buyer_profile?.first_name || ''} ${order.buyer_profile?.last_name || ''}`.trim() ||
                   'Customer'}
                </Text>
              </View>
            </View>

            {/* Items Table */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Items:</Text>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.itemColumn]}>Item</Text>
                  <Text style={[styles.tableHeaderText, styles.qtyColumn]}>Qty</Text>
                  <Text style={[styles.tableHeaderText, styles.priceColumn]}>Price</Text>
                  <Text style={[styles.tableHeaderText, styles.totalColumn]}>Total</Text>
                </View>

                {/* Table Rows */}
                {order.order_items?.map((item, index) => (
                  <View key={index} style={styles.tableRow}>
                    <View style={styles.itemColumn}>
                      <Text style={styles.itemName}>{item.product.name}</Text>
                      <Text style={styles.itemUnit}>Unit: {item.product.unit}</Text>
                    </View>
                    <Text style={[styles.tableText, styles.qtyColumn]}>
                      {item.quantity}
                    </Text>
                    <Text style={[styles.tableText, styles.priceColumn]}>
                      {formatPrice(item.unit_price)}
                    </Text>
                    <Text style={[styles.tableText, styles.totalColumn]}>
                      {formatPrice(item.total_price)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Totals Section */}
            <View style={styles.totalsSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal:</Text>
                <Text style={styles.totalValue}>{formatPrice(calculateSubtotal())}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax (0%):</Text>
                <Text style={styles.totalValue}>{formatPrice(0)}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total:</Text>
                <Text style={styles.grandTotalValue}>{formatPrice(order.total_amount)}</Text>
              </View>
            </View>

            {/* Proof of Payment */}
            {order.proof_of_payment && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Proof of Payment:</Text>
                <View style={styles.proofContainer}>
                  <Image
                    source={{ uri: order.proof_of_payment }}
                    style={styles.proofImage}
                    resizeMode="contain"
                  />
                  <View style={styles.proofStatus}>
                    <Icon name="check-circle" size={16} color="#10b981" />
                    <Text style={styles.proofStatusText}>Payment Verified</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Footer */}
            <View style={styles.invoiceFooter}>
              <Text style={styles.footerText}>Thank you for your business!</Text>
              <Text style={styles.footerNote}>
                This is a computer-generated invoice and does not require a signature.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.closeButtonBottom}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 600,
    maxHeight: '90%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },

  // Invoice Header
  invoiceHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#10b981',
    marginBottom: 24,
  },
  invoiceTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  invoiceDate: {
    fontSize: 14,
    color: '#94a3b8',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressBox: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  tableText: {
    fontSize: 14,
    color: '#334155',
  },
  itemColumn: {
    flex: 2,
  },
  qtyColumn: {
    flex: 0.8,
    textAlign: 'center',
  },
  priceColumn: {
    flex: 1,
    textAlign: 'right',
  },
  totalColumn: {
    flex: 1,
    textAlign: 'right',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  itemUnit: {
    fontSize: 12,
    color: '#64748b',
  },

  // Totals
  totalsSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    borderTopColor: '#10b981',
    paddingTop: 12,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },

  // Proof of Payment
  proofContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  proofImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  proofStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proofStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },

  // Footer
  invoiceFooter: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 8,
  },
  footerNote: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Modal Actions
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  closeButtonBottom: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
