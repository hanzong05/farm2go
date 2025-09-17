import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';
import NavBar from '../../components/NavBar';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  quantity_available: number;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  low_stock_threshold?: number;
}

interface InventoryStats {
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalValue: number;
  approvedProducts: number;
}

const CATEGORIES = [
  'All',
  'Vegetables',
  'Fruits',
  'Grains',
  'Herbs',
  'Dairy',
  'Meat',
  'Other'
];

export default function FarmerInventoryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        router.replace('/auth/login');
        return;
      }

      setProfile(userData.profile);
      await loadProducts(userData.user.id);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (farmerId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const productsWithThreshold = data?.map(product => ({
        ...product,
        low_stock_threshold: 10, // Default threshold, could be customizable
      })) || [];

      setProducts(productsWithThreshold);
    } catch (error) {
      console.error('Error loading products:', error);
      throw error;
    }
  };

  const filterProducts = () => {
    if (selectedCategory === 'All') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(product => product.category === selectedCategory));
    }
  };

  const onRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      const userData = await getUserWithProfile();
      if (userData?.user) {
        await loadProducts(userData.user.id);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const updateStock = async () => {
    if (!selectedProduct || !newStock) return;

    const stockValue = parseInt(newStock);
    if (isNaN(stockValue) || stockValue < 0) {
      Alert.alert('Error', 'Please enter a valid stock quantity');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ quantity_available: stockValue })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      // Update local state
      setProducts(prevProducts =>
        prevProducts.map(product =>
          product.id === selectedProduct.id
            ? { ...product, quantity_available: stockValue }
            : product
        )
      );

      setShowStockModal(false);
      setSelectedProduct(null);
      setNewStock('');
      Alert.alert('Success', 'Stock updated successfully');
    } catch (error) {
      console.error('Error updating stock:', error);
      Alert.alert('Error', 'Failed to update stock');
    }
  };

  const deleteProduct = async (productId: string) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);

              if (error) throw error;

              setProducts(prevProducts =>
                prevProducts.filter(product => product.id !== productId)
              );

              Alert.alert('Success', 'Product deleted successfully');
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert('Error', 'Failed to delete product');
            }
          },
        },
      ]
    );
  };

  const getInventoryStats = (): InventoryStats => {
    const stats = products.reduce(
      (acc, product) => {
        acc.totalProducts += 1;
        if (product.quantity_available === 0) {
          acc.outOfStockProducts += 1;
        } else if (product.quantity_available <= (product.low_stock_threshold || 10)) {
          acc.lowStockProducts += 1;
        }
        if (product.status === 'approved') {
          acc.approvedProducts += 1;
          acc.totalValue += product.price * product.quantity_available;
        }
        return acc;
      },
      {
        totalProducts: 0,
        lowStockProducts: 0,
        outOfStockProducts: 0,
        totalValue: 0,
        approvedProducts: 0,
      }
    );

    return stats;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  const getStockStatus = (product: Product) => {
    if (product.quantity_available === 0) {
      return { status: 'Out of Stock', color: '#dc2626', bgColor: '#fecaca' };
    } else if (product.quantity_available <= (product.low_stock_threshold || 10)) {
      return { status: 'Low Stock', color: '#f59e0b', bgColor: '#fef3c7' };
    } else {
      return { status: 'In Stock', color: '#16a34a', bgColor: '#dcfce7' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return { color: '#16a34a', bgColor: '#dcfce7' };
      case 'pending':
        return { color: '#f59e0b', bgColor: '#fef3c7' };
      case 'rejected':
        return { color: '#dc2626', bgColor: '#fecaca' };
      default:
        return { color: '#6b7280', bgColor: '#f3f4f6' };
    }
  };

  const renderStatsCard = (title: string, value: string | number, color: string, icon: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Text style={[styles.statIcon, { color }]}>{icon}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const renderProductCard = ({ item: product }: { item: Product }) => {
    const stockStatus = getStockStatus(product);
    const statusColor = getStatusColor(product.status);

    return (
      <View style={styles.productCard}>
        <View style={styles.productHeader}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productCategory}>{product.category}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bgColor }]}>
            <Text style={[styles.statusText, { color: statusColor.color }]}>
              {product.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.productDetails}>
          <Text style={styles.productPrice}>{formatPrice(product.price)} per {product.unit}</Text>
          <View style={[styles.stockBadge, { backgroundColor: stockStatus.bgColor }]}>
            <Text style={[styles.stockText, { color: stockStatus.color }]}>
              {stockStatus.status}
            </Text>
          </View>
        </View>

        <View style={styles.quantityRow}>
          <Text style={styles.quantityLabel}>Available:</Text>
          <Text style={styles.quantityValue}>
            {product.quantity_available} {product.unit}
          </Text>
        </View>

        <View style={styles.productActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => router.push(`/farmer/products/edit/${product.id}` as any)}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.stockButton]}
            onPress={() => {
              setSelectedProduct(product);
              setNewStock(product.quantity_available.toString());
              setShowStockModal(true);
            }}
          >
            <Text style={styles.actionButtonText}>Update Stock</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteProduct(product.id)}
          >
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>=æ</Text>
      <Text style={styles.emptyTitle}>No Products Found</Text>
      <Text style={styles.emptyDescription}>
        {selectedCategory === 'All'
          ? 'Start by adding your first product to manage your inventory.'
          : `No products found in the ${selectedCategory} category.`}
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push('/farmer/products/add')}
      >
        <Text style={styles.addButtonText}>Add Product</Text>
      </TouchableOpacity>
    </View>
  );

  const stats = getInventoryStats();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavBar currentRoute="/farmer/inventory" />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#16a34a"
            colors={['#16a34a']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            {renderStatsCard('Total Products', stats.totalProducts, '#3b82f6', '=Ê')}
            {renderStatsCard('Approved', stats.approvedProducts, '#16a34a', '')}
          </View>
          <View style={styles.statsRow}>
            {renderStatsCard('Low Stock', stats.lowStockProducts, '#f59e0b', ' ')}
            {renderStatsCard('Total Value', formatPrice(stats.totalValue), '#8b5cf6', '=°')}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push('/farmer/products/add')}
          >
            <Text style={styles.primaryActionText}>+ Add New Product</Text>
          </TouchableOpacity>

          {stats.lowStockProducts > 0 && (
            <TouchableOpacity
              style={styles.warningAction}
              onPress={() => setSelectedCategory('All')} // Could filter to show only low stock
            >
              <Text style={styles.warningActionText}>  {stats.lowStockProducts} Low Stock Items</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterButton,
                selectedCategory === category && styles.filterButtonActive
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedCategory === category && styles.filterButtonTextActive
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products List */}
        <View style={styles.productsContainer}>
          <Text style={styles.sectionTitle}>
            Inventory ({filteredProducts.length} items)
          </Text>

          {filteredProducts.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={filteredProducts}
              renderItem={renderProductCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.productsList}
            />
          )}
        </View>
      </ScrollView>

      {/* Update Stock Modal */}
      <Modal
        visible={showStockModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Stock</Text>
            {selectedProduct && (
              <Text style={styles.modalSubtitle}>{selectedProduct.name}</Text>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Quantity Available</Text>
              <TextInput
                style={styles.input}
                value={newStock}
                onChangeText={setNewStock}
                placeholder="Enter quantity"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowStockModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.updateButton]}
                onPress={updateStock}
              >
                <Text style={styles.updateButtonText}>Update</Text>
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
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingTop: 16,
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
    color: '#64748b',
  },

  // Stats
  statsContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },

  // Actions
  actionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  primaryAction: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningAction: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  warningActionText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },

  // Filter
  filterContainer: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },

  // Products
  productsContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  productsList: {
    gap: 16,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  quantityLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#3b82f6',
  },
  stockButton: {
    backgroundColor: '#8b5cf6',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  addButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  updateButton: {
    backgroundColor: '#16a34a',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});