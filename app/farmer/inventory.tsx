import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

// Farm2Go green color palette
const colors = {
  primary: '#059669',
  secondary: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  background: '#f0f9f4',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
  gray100: '#f9fafb',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
};

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
  { key: 'all', label: 'All Products', icon: '🛍️' },
  { key: 'vegetables', label: 'Vegetables', icon: '🥬' },
  { key: 'fruits', label: 'Fruits', icon: '🍎' },
  { key: 'grains', label: 'Grains', icon: '🌾' },
  { key: 'herbs', label: 'Herbs', icon: '🌿' },
  { key: 'dairy', label: 'Dairy', icon: '🥛' },
  { key: 'meat', label: 'Meat', icon: '🥩' },
  { key: 'other', label: 'Other', icon: '📦' },
];

export default function Farm2GoInventoryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
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

      const productsWithThreshold: Product[] = data.map((product): Product => ({
        ...product as DatabaseProduct,
        low_stock_threshold: 10,
      }));

      setProducts(productsWithThreshold);
    } catch (error) {
      console.error('Error loading products:', error);
      throw error;
    }
  };

  const filterProducts = () => {
    if (selectedCategory === 'all') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(product => 
        product.category.toLowerCase() === selectedCategory.toLowerCase()
      ));
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
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStockStatus = (product: Product) => {
    if (product.quantity_available === 0) {
      return { status: 'Out of Stock', color: colors.danger, bgColor: colors.danger + '20' };
    } else if (product.quantity_available <= (product.low_stock_threshold || 10)) {
      return { status: 'Low Stock', color: colors.warning, bgColor: colors.warning + '20' };
    } else {
      return { status: 'In Stock', color: colors.success, bgColor: colors.success + '20' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return { color: colors.success, bgColor: colors.success + '20' };
      case 'pending':
        return { color: colors.warning, bgColor: colors.warning + '20' };
      case 'rejected':
        return { color: colors.danger, bgColor: colors.danger + '20' };
      default:
        return { color: colors.textSecondary, bgColor: colors.gray200 };
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Top Bar with Branding */}
      <View style={styles.topBar}>
        <View style={styles.brandSection}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F2G</Text>
          </View>
          <View>
            <Text style={styles.brandText}>Inventory Center</Text>
            <Text style={styles.taglineText}>Manage your stock levels</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/farmer/products/add')}
        >
          <Text style={styles.addButtonText}>+ Add Product</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <View style={styles.categorySection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContainer}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.key}
              style={[
                styles.categoryTab,
                selectedCategory === category.key && styles.categoryTabActive
              ]}
              onPress={() => setSelectedCategory(category.key)}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={[
                styles.categoryText,
                selectedCategory === category.key && styles.categoryTextActive
              ]}>
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>TOTAL PRODUCTS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.approvedProducts}</Text>
            <Text style={styles.statLabel}>LIVE PRODUCTS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.lowStockProducts}</Text>
            <Text style={styles.statLabel}>LOW STOCK</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{formatPrice(stats.totalValue)}</Text>
            <Text style={styles.statLabel}>TOTAL VALUE</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderText, styles.productColumn]}>Product</Text>
      <Text style={[styles.tableHeaderText, styles.categoryColumn]}>Category</Text>
      <Text style={[styles.tableHeaderText, styles.priceColumn]}>Price</Text>
      <Text style={[styles.tableHeaderText, styles.stockColumn]}>Stock</Text>
      <Text style={[styles.tableHeaderText, styles.statusColumn]}>Status</Text>
      <Text style={[styles.tableHeaderText, styles.actionsColumn]}>Actions</Text>
    </View>
  );

  const renderTableRow = ({ item: product }: { item: Product }) => {
    const stockStatus = getStockStatus(product);
    const statusColor = getStatusColor(product.status);
    
    return (
      <TouchableOpacity 
        style={styles.tableRow}
        onPress={() => router.push(`/farmer/products/${product.id}` as any)}
        activeOpacity={0.7}
      >
        {/* Product Column */}
        <View style={styles.productColumn}>
          <View style={styles.productInfo}>
            <View style={styles.productImageContainer}>
              {product.image_url ? (
                <Image source={{ uri: product.image_url }} style={styles.productTableImage} />
              ) : (
                <View style={styles.placeholderTableImage}>
                  <Text style={styles.placeholderTableIcon}>🥬</Text>
                </View>
              )}
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
              <Text style={styles.productDescription} numberOfLines={1}>
                {product.description || 'No description'}
              </Text>
            </View>
          </View>
        </View>

        {/* Category Column */}
        <View style={styles.categoryColumn}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {product.category}
            </Text>
          </View>
        </View>

        {/* Price Column */}
        <View style={styles.priceColumn}>
          <Text style={styles.priceText}>{formatPrice(product.price)}</Text>
          <Text style={styles.unitText}>/{product.unit}</Text>
        </View>

        {/* Stock Column */}
        <View style={styles.stockColumn}>
          <Text style={styles.stockQuantity}>{product.quantity_available}</Text>
          <View style={[styles.stockStatusBadge, { backgroundColor: stockStatus.bgColor }]}>
            <Text style={[styles.stockStatusText, { color: stockStatus.color }]}>
              {stockStatus.status}
            </Text>
          </View>
        </View>

        {/* Status Column */}
        <View style={styles.statusColumn}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bgColor }]}>
            <Text style={[styles.statusText, { color: statusColor.color }]}>
              {product.status === 'approved' ? 'LIVE' :
               product.status === 'pending' ? 'REVIEW' : 'REJECTED'}
            </Text>
          </View>
        </View>

        {/* Actions Column */}
        <View style={styles.actionsColumn}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/farmer/products/edit/${product.id}` as any);
              }}
            >
              <Text style={styles.actionIcon}>✏️</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.stockButton}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedProduct(product);
                setNewStock(product.quantity_available.toString());
                setShowStockModal(true);
              }}
            >
              <Text style={styles.actionIcon}>📝</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={(e) => {
                e.stopPropagation();
                deleteProduct(product.id);
              }}
            >
              <Text style={styles.actionIcon}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Text style={styles.emptyIcon}>📦</Text>
      </View>
      <Text style={styles.emptyTitle}>
        {selectedCategory === 'all' ? 'No Products Yet' : 'No Products in Category'}
      </Text>
      <Text style={styles.emptyDescription}>
        {selectedCategory === 'all'
          ? 'Start building your inventory by adding your first product'
          : `No products found in ${CATEGORIES.find(c => c.key === selectedCategory)?.label}`}
      </Text>
      
      {selectedCategory === 'all' && (
        <TouchableOpacity
          style={styles.emptyAction}
          onPress={() => router.push('/farmer/products/add')}
        >
          <Text style={styles.emptyActionText}>+ Add Your First Product</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const stats = getInventoryStats();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your inventory...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        
        {/* Table Container */}
        <View style={styles.tableContainer}>
          {renderTableHeader()}
          
          {filteredProducts.length > 0 ? (
            <FlatList
              data={filteredProducts}
              renderItem={renderTableRow}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            renderEmptyState()
          )}
        </View>
      </ScrollView>

      {/* Stock Update Modal */}
      <Modal
        visible={showStockModal}
        transparent
        animationType="slide"
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
              <View style={styles.currentStockInfo}>
                <Text style={styles.currentStockLabel}>Current Stock</Text>
                <Text style={styles.currentStockValue}>
                  {selectedProduct?.quantity_available} {selectedProduct?.unit}
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>New Quantity</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={newStock}
                    onChangeText={setNewStock}
                    placeholder="Enter quantity"
                    placeholderTextColor={colors.textSecondary}
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
                style={styles.cancelButton}
                onPress={() => setShowStockModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.updateButton}
                onPress={updateStock}
              >
                <Text style={styles.updateButtonText}>Update Stock</Text>
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
    backgroundColor: colors.background,
  },
  
  scrollContainer: {
    flex: 1,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },

  // Header Styles
  header: {
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 50,
    backgroundColor: colors.primary,
  },
  
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  
  logoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  
  brandText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },
  
  taglineText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  
  addButton: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Stats Banner
  statsBanner: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  // Category Section
  categorySection: {
    backgroundColor: colors.white,
    paddingBottom: 16,
  },
  
  categoryContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    marginRight: 8,
  },
  
  categoryTabActive: {
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  
  categoryIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  
  categoryTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Table Styles
  tableContainer: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  tableHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  
  // Column Styles
  productColumn: {
    flex: 3,
    minWidth: 180,
  },
  
  categoryColumn: {
    flex: 1.5,
    minWidth: 100,
  },
  
  priceColumn: {
    flex: 1.5,
    minWidth: 80,
  },
  
  stockColumn: {
    flex: 1.5,
    minWidth: 100,
  },
  
  statusColumn: {
    flex: 1.2,
    minWidth: 80,
  },
  
  actionsColumn: {
    flex: 1.8,
    minWidth: 120,
  },
  
  // Product Info Styles
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  productImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  
  productTableImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  
  placeholderTableImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  placeholderTableIcon: {
    fontSize: 16,
  },
  
  productDetails: {
    flex: 1,
  },
  
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  
  productDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  
  // Category Badge
  categoryBadge: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  
  categoryBadgeText: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  
  // Price Styles
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  
  unitText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  
  // Stock Styles
  stockQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  
  stockStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  
  stockStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  
  // Status Badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  stockButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.warning + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  actionIcon: {
    fontSize: 12,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  
  emptyIcon: {
    fontSize: 32,
  },
  
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  
  emptyDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  
  emptyAction: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  
  modalBody: {
    padding: 20,
  },
  
  currentStockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    marginBottom: 20,
  },
  
  currentStockLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  currentStockValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  
  inputContainer: {
    marginBottom: 4,
  },
  
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  
  inputUnit: {
    paddingRight: 16,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  updateButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  
  updateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
});