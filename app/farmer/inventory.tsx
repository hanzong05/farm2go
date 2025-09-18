import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import NavBar from '../../components/NavBar';
import StatCard from '../../components/StatCard';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

type Profile = Database['public']['Tables']['profiles']['Row'];
type DatabaseProduct = Database['public']['Tables']['products']['Row'];

interface Product extends Omit<DatabaseProduct, 'low_stock_threshold'> {
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

      if (!data) {
        setProducts([]);
        return;
      }

      // Properly type the products with threshold
      const productsWithThreshold: Product[] = data.map((product): Product => ({
        ...product as DatabaseProduct,
        low_stock_threshold: 10, // Default threshold, could be customizable
      }));

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
      const { error } = await (supabase as any)
        .from('products')
        .update({ quantity_available: stockValue })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      // Update local state with proper type casting
      setProducts(prevProducts =>
        prevProducts.map((product) => {
          if (product.id === selectedProduct.id) {
            return { ...product, quantity_available: stockValue } as Product;
          }
          return product;
        })
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

              // Update local state with proper typing
              setProducts(prevProducts =>
                prevProducts.filter((product) => product.id !== productId)
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
      return { status: 'Out of Stock', color: '#dc2626', bgColor: '#fee2e2' };
    } else if (product.quantity_available <= (product.low_stock_threshold || 10)) {
      return { status: 'Low Stock', color: '#d97706', bgColor: '#fef3c7' };
    } else {
      return { status: 'In Stock', color: '#059669', bgColor: '#ecfdf5' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return { color: '#059669', bgColor: '#ecfdf5' };
      case 'pending':
        return { color: '#d97706', bgColor: '#fffbeb' };
      case 'rejected':
        return { color: '#dc2626', bgColor: '#fee2e2' };
      default:
        return { color: '#64748b', bgColor: '#f1f5f9' };
    }
  };

  const renderWelcomeHeader = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeContent}>
        <View style={styles.welcomeTextContainer}>
          <Text style={styles.welcomeTitle}>Inventory Management</Text>
          <Text style={styles.welcomeSubtitle}>
            Track your products, manage stock levels, and monitor inventory performance
          </Text>
        </View>
        <View style={styles.welcomeIconContainer}>
          <Text style={styles.welcomeIcon}>📦</Text>
        </View>
      </View>
    </View>
  );


  const renderProductCard = ({ item: product }: { item: Product }) => {
    const stockStatus = getStockStatus(product);
    const statusColor = getStatusColor(product.status);

    return (
      <TouchableOpacity 
        style={styles.productCard}
        onPress={() => router.push(`/farmer/products/${product.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.productHeader}>
          <View style={styles.productMainInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productCategory}>{product.category}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bgColor }]}>
            <Text style={[styles.statusText, { color: statusColor.color }]}>
              {product.status === 'approved' ? 'LIVE' :
               product.status === 'pending' ? 'REVIEW' : 'REJECTED'}
            </Text>
          </View>
        </View>

        <View style={styles.productMetrics}>
          <View style={styles.priceSection}>
            <Text style={styles.metricLabel}>Price</Text>
            <Text style={styles.priceValue}>{formatPrice(product.price)}</Text>
            <Text style={styles.metricUnit}>per {product.unit}</Text>
          </View>
          
          <View style={styles.metricsVerticalDivider} />
          
          <View style={styles.stockSection}>
            <Text style={styles.metricLabel}>Stock</Text>
            <Text style={styles.stockValue}>{product.quantity_available}</Text>
            <Text style={styles.metricUnit}>{product.unit}</Text>
          </View>
        </View>

        <View style={[styles.stockStatusContainer, { backgroundColor: stockStatus.bgColor }]}>
          <Text style={[styles.stockStatusText, { color: stockStatus.color }]}>
            {stockStatus.status}
          </Text>
        </View>

        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.editActionButton}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/farmer/products/edit/${product.id}` as any);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.editActionText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stockActionButton}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedProduct(product);
              setNewStock(product.quantity_available.toString());
              setShowStockModal(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.stockActionText}>Update Stock</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteActionButton}
            onPress={(e) => {
              e.stopPropagation();
              deleteProduct(product.id);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
        </View>
      </View>
      
      <Text style={styles.emptyTitle}>No Products Found</Text>
      <Text style={styles.emptyDescription}>
        {selectedCategory === 'All'
          ? 'Start by adding your first product to manage your inventory.'
          : `No products found in the ${selectedCategory} category.`}
      </Text>

      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => router.push('/farmer/products/add')}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaIcon}>+</Text>
        <Text style={styles.ctaText}>Add Product</Text>
      </TouchableOpacity>
    </View>
  );

  const stats = getInventoryStats();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading inventory dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavBar currentRoute="/farmer/inventory" />

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
        {renderWelcomeHeader()}

        {/* Enhanced Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Inventory Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard title="Total Products" value={stats.totalProducts} color="#6366f1" backgroundColor="#f0f0ff" icon="📊" />
            <StatCard title="Live Products" value={stats.approvedProducts} color="#10b981" backgroundColor="#ecfdf5" icon="✅" />
            <StatCard title="Low Stock" value={stats.lowStockProducts} color="#f59e0b" backgroundColor="#fffbeb" icon="⚠️" />
            <StatCard title="Total Value" value={formatPrice(stats.totalValue)} color="#06b6d4" backgroundColor="#ecfeff" icon="💰" />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.primaryActionCard}
              onPress={() => router.push('/farmer/products/add')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryActionIcon}>+</Text>
              <Text style={styles.primaryActionTitle}>Add Product</Text>
              <Text style={styles.primaryActionSubtitle}>List new produce</Text>
            </TouchableOpacity>

            {stats.lowStockProducts > 0 && (
              <TouchableOpacity
                style={styles.warningActionCard}
                onPress={() => setSelectedCategory('All')}
                activeOpacity={0.8}
              >
                <Text style={styles.warningActionIcon}>⚠️</Text>
                <Text style={styles.warningActionTitle}>{stats.lowStockProducts} Low Stock</Text>
                <Text style={styles.warningActionSubtitle}>Need attention</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Enhanced Category Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Filter by Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.filterButton,
                  selectedCategory === category && styles.filterButtonActive
                ]}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.7}
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
        </View>

        {/* Products List */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Inventory {filteredProducts.length > 0 && `(${filteredProducts.length})`}
            </Text>
          </View>

          {filteredProducts.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.productsList}>
              {filteredProducts.map((product) => (
                <View key={product.id}>
                  {renderProductCard({ item: product })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Enhanced Stock Update Modal */}
      <Modal
        visible={showStockModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Stock</Text>
              {selectedProduct && (
                <Text style={styles.modalSubtitle}>{selectedProduct.name}</Text>
              )}
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Quantity Available <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={newStock}
                    onChangeText={setNewStock}
                    placeholder="Enter quantity"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputUnit}>
                    {selectedProduct?.unit || 'units'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setShowStockModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.updateModalButton}
                onPress={updateStock}
                activeOpacity={0.7}
              >
                <Text style={styles.updateModalText}>Update Stock</Text>
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

  // Loading
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

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Welcome Header
  welcomeContainer: {
    backgroundColor: '#10b981',
    margin: 20,
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 28,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 26,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
    lineHeight: 20,
  },
  welcomeIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 20,
  },
  welcomeIcon: {
    fontSize: 32,
  },

  // Section Titles
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 20,
  },

  // Stats Section
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  // Actions Section
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  primaryActionCard: {
    flex: 2,
    backgroundColor: '#10b981',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  primaryActionIcon: {
    fontSize: 32,
    color: '#ffffff',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  primaryActionTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  primaryActionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  warningActionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  warningActionIcon: {
    fontSize: 28,
    marginBottom: 12,
  },
  warningActionTitle: {
    fontSize: 14,
    color: '#d97706',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  warningActionSubtitle: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '500',
  },

  // Filter Section
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  filterContainer: {
    paddingRight: 20,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
    elevation: 4,
    shadowOpacity: 0.15,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },

  // Products Section
  productsSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    marginBottom: 24,
  },
  productsList: {
    gap: 20,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  productMainInfo: {
    flex: 1,
    marginRight: 16,
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 26,
  },
  productCategory: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  productMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  priceSection: {
    flex: 1,
    alignItems: 'center',
  },
  stockSection: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 4,
  },
  stockValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  metricUnit: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  metricsVerticalDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 20,
  },
  stockStatusContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  stockStatusText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  productActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editActionButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stockActionButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deleteActionButton: {
    flex: 1,
    backgroundColor: '#fee2e2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  editActionText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  stockActionText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  deleteActionText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIllustration: {
    marginBottom: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#bbf7d0',
  },
  emptyIcon: {
    fontSize: 60,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 36,
    paddingVertical: 20,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  ctaIcon: {
    fontSize: 22,
    color: '#ffffff',
    marginRight: 12,
    fontWeight: 'bold',
  },
  ctaText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },

  // Enhanced Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalHeader: {
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  modalBody: {
    padding: 24,
  },
  inputContainer: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#dc2626',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  inputUnit: {
    paddingRight: 16,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    gap: 16,
  },
  cancelModalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  updateModalButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#10b981',
    elevation: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cancelModalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  updateModalText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});