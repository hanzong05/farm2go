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
import { router } from 'expo-router';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

type Product = Database['public']['Tables']['products']['Row'] & {
  farmer_profile?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
  };
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showSidebar, setShowSidebar] = useState(false);

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const isMobile = width < 768;

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedStatus, selectedCategory, sortBy]);

  const filterProducts = () => {
    let filtered = products;

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(product => product.status === selectedStatus);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category.toLowerCase() === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.farmer_profile?.first_name?.toLowerCase().includes(query) ||
        product.farmer_profile?.last_name?.toLowerCase().includes(query) ||
        product.farmer_profile?.farm_name?.toLowerCase().includes(query)
      );
    }

    // Sort products
    switch (sortBy) {
      case 'price-low':
        filtered = filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered = filtered.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'farmer':
        filtered = filtered.sort((a, b) => {
          const farmerA = `${a.farmer_profile?.first_name || ''} ${a.farmer_profile?.last_name || ''}`;
          const farmerB = `${b.farmer_profile?.first_name || ''} ${b.farmer_profile?.last_name || ''}`;
          return farmerA.localeCompare(farmerB);
        });
        break;
      case 'newest':
      default:
        filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    setFilteredProducts(filtered);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);

      // Verify admin access
      const userData = await getUserWithProfile();
      if (!userData?.profile || !['admin', 'super-admin'].includes(userData.profile.user_type)) {
        Alert.alert('Access Denied', 'You do not have permission to access this page.');
        router.back();
        return;
      }

      // Load products with farmer info
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          farmer_profile:profiles!products_farmer_id_fkey(
            first_name,
            last_name,
            farm_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleProductAction = async (productId: string, action: 'approved' | 'rejected') => {
    const product = products.find(p => p.id === productId);
    const farmerName = product?.farmer_profile ?
      `${product.farmer_profile.first_name} ${product.farmer_profile.last_name}` :
      'Unknown Farmer';

    Alert.alert(
      `${action === 'approved' ? 'Approve' : 'Reject'} Product?`,
      `Are you sure you want to ${action === 'approved' ? 'approve' : 'reject'} "${product?.name}" by ${farmerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Yes, ${action === 'approved' ? 'Approve' : 'Reject'}`,
          style: action === 'approved' ? 'default' : 'destructive',
          onPress: () => updateProductStatus(productId, action)
        }
      ]
    );
  };

  const updateProductStatus = async (productId: string, status: 'approved' | 'rejected') => {
    try {
      setProcessing(productId);

      const { error } = await supabase
        .from('products')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) throw error;

      Alert.alert(
        'Success!',
        `Product ${status} successfully`,
        [{ text: 'OK', onPress: () => loadProducts() }]
      );
    } catch (error) {
      console.error('Error updating product:', error);
      Alert.alert('Error', 'Failed to update product status');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'pending': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Pending Review';
      default: return status;
    }
  };

  const categories = [
    { key: 'all', label: 'All Categories' },
    { key: 'vegetables', label: 'Vegetables' },
    { key: 'fruits', label: 'Fruits' },
    { key: 'grains', label: 'Grains' },
    { key: 'herbs', label: 'Herbs' },
    { key: 'dairy', label: 'Dairy' },
    { key: 'meat', label: 'Meat' }
  ];

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      {/* Status Filter */}
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Status</Text>
        {[
          { key: 'all', label: 'All Status' },
          { key: 'pending', label: 'Pending Review' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' }
        ].map((status) => (
          <TouchableOpacity
            key={status.key}
            style={[
              styles.sidebarCategoryItem,
              selectedStatus === status.key && styles.sidebarCategoryItemActive
            ]}
            onPress={() => setSelectedStatus(status.key)}
          >
            <Text style={[
              styles.sidebarCategoryText,
              selectedStatus === status.key && styles.sidebarCategoryTextActive
            ]}>
              {status.label}
            </Text>
            <Text style={styles.sidebarCategoryCount}>
              {status.key === 'all'
                ? products.length
                : products.filter(p => p.status === status.key).length}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Categories */}
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Categories</Text>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.key}
            style={[
              styles.sidebarCategoryItem,
              selectedCategory === category.key && styles.sidebarCategoryItemActive
            ]}
            onPress={() => setSelectedCategory(category.key)}
          >
            <Text style={[
              styles.sidebarCategoryText,
              selectedCategory === category.key && styles.sidebarCategoryTextActive
            ]}>
              {category.label}
            </Text>
            <Text style={styles.sidebarCategoryCount}>
              {category.key === 'all'
                ? products.length
                : products.filter(p => p.category.toLowerCase() === category.key).length}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sort By */}
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Sort By</Text>
        {[
          { key: 'newest', label: 'Newest First' },
          { key: 'name', label: 'Name A-Z' },
          { key: 'farmer', label: 'Farmer Name' },
          { key: 'price-low', label: 'Price: Low to High' },
          { key: 'price-high', label: 'Price: High to Low' }
        ].map((sort) => (
          <TouchableOpacity
            key={sort.key}
            style={[
              styles.sortItem,
              sortBy === sort.key && styles.sortItemActive
            ]}
            onPress={() => setSortBy(sort.key)}
          >
            <Text style={[
              styles.sortText,
              sortBy === sort.key && styles.sortTextActive
            ]}>
              {sort.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reset Filters */}
      <TouchableOpacity
        style={styles.resetButton}
        onPress={() => {
          setSelectedCategory('all');
          setSelectedStatus('all');
          setSortBy('newest');
          setSearchQuery('');
        }}
      >
        <Text style={styles.resetButtonText}>Reset All Filters</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCompactProduct = (product: Product) => {
    const farmerName = product.farmer_profile ?
      `${product.farmer_profile.first_name} ${product.farmer_profile.last_name}` :
      'Unknown Farmer';

    const isProcessing = processing === product.id;

    return (
      <View style={styles.compactProductCard}>
        {/* Product Image */}
        <View style={styles.compactImageContainer}>
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              style={styles.compactProductImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.compactPlaceholderImage}>
              <Text style={styles.compactPlaceholderIcon}>🥬</Text>
            </View>
          )}
          {/* Status Badge */}
          <View style={[styles.compactStatusBadge, { backgroundColor: getStatusColor(product.status) }]}>
            <Text style={styles.compactStatusText}>{getStatusText(product.status)}</Text>
          </View>
        </View>

        {/* Product Info */}
        <View style={styles.compactProductInfo}>
          <View style={styles.compactHeader}>
            <Text style={styles.compactProductName} numberOfLines={1}>
              {product.name}
            </Text>
            <View style={styles.compactCategoryBadge}>
              <Text style={styles.compactCategoryText}>{product.category}</Text>
            </View>
          </View>

          <Text style={styles.compactFarmerText} numberOfLines={1}>
            👨‍🌾 {farmerName}
          </Text>

          {product.farmer_profile?.farm_name && (
            <Text style={styles.compactFarmText} numberOfLines={1}>
              🏡 {product.farmer_profile.farm_name}
            </Text>
          )}

          <View style={styles.compactPriceContainer}>
            <Text style={styles.compactPrice}>₱{product.price.toFixed(2)}</Text>
            <Text style={styles.compactUnit}>/{product.unit}</Text>
          </View>

          <View style={styles.compactMeta}>
            <Text style={styles.compactStockText}>Stock: {product.quantity_available}</Text>
            <Text style={styles.compactDateText}>
              {new Date(product.created_at).toLocaleDateString()}
            </Text>
          </View>

          {/* Action Buttons - Only show for pending products */}
          {product.status === 'pending' && (
            <View style={styles.compactActions}>
              <TouchableOpacity
                style={styles.compactRejectButton}
                onPress={() => handleProductAction(product.id, 'rejected')}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.compactRejectButtonText}>Reject</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.compactApproveButton}
                onPress={() => handleProductAction(product.id, 'approved')}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.compactApproveButtonText}>Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderProduct = (product: Product) => {
    const farmerName = product.farmer_profile ?
      `${product.farmer_profile.first_name} ${product.farmer_profile.last_name}` :
      'Unknown Farmer';

    const farmName = product.farmer_profile?.farm_name;
    const isProcessing = processing === product.id;

    return (
      <View key={product.id} style={styles.productCard}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Text style={styles.noImageText}>No Image</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(product.status) }]}>
              <Text style={styles.statusText}>{getStatusText(product.status)}</Text>
            </View>
          </View>

          <Text style={styles.farmerName}>by {farmerName}</Text>
          {farmName && <Text style={styles.farmName}>{farmName}</Text>}

          <Text style={styles.productDescription} numberOfLines={2}>
            {product.description || 'No description provided'}
          </Text>

          <View style={styles.productDetails}>
            <Text style={styles.price}>₱{product.price.toFixed(2)}/{product.unit}</Text>
            <Text style={styles.category}>{product.category}</Text>
            <Text style={styles.quantity}>{product.quantity_available} available</Text>
          </View>

          {/* Action Buttons - Only show for pending products */}
          {product.status === 'pending' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleProductAction(product.id, 'rejected')}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Reject</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleProductAction(product.id, 'approved')}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderComponent />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search products, farmers..."
        showFilterButton={!isDesktop}
        onFilterPress={() => setShowSidebar(!showSidebar)}
      />

      {/* Desktop Layout with Sidebar */}
      {isDesktop ? (
        <View style={styles.desktopLayout}>
          {/* Sidebar */}
          {renderSidebar()}

          {/* Main Content */}
          <ScrollView
            style={styles.mainContent}
            contentContainerStyle={styles.mainScrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#10B981"
                colors={['#10B981']}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* Products Header */}
            <View style={styles.productsHeader}>
              <Text style={styles.productsTitle}>
                Product Management
              </Text>
              <Text style={styles.productsCount}>
                {filteredProducts.length} products found
              </Text>
            </View>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            ) : (
              <View style={styles.productsGrid}>
                {filteredProducts.map((product) => (
                  <View key={product.id}>
                    {renderCompactProduct(product)}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      ) : (
        /* Mobile/Tablet Layout */
        <View style={styles.container}>
          {/* Mobile Sidebar Overlay */}
          {showSidebar && (
            <View style={styles.mobileOverlay}>
              <TouchableOpacity
                style={styles.overlayBackground}
                onPress={() => setShowSidebar(false)}
              />
              <View style={styles.mobileSidebar}>
                {renderSidebar()}
                <TouchableOpacity
                  style={styles.closeSidebarButton}
                  onPress={() => setShowSidebar(false)}
                >
                  <Text style={styles.closeSidebarText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ScrollView
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            {filteredProducts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            ) : (
              <View style={styles.productsList}>
                {filteredProducts.map(renderProduct)}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
  productsList: {
    paddingVertical: 16,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 200,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  productInfo: {
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  farmerName: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 4,
  },
  farmName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
  category: {
    fontSize: 14,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quantity: {
    fontSize: 14,
    color: '#374151',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Desktop Layout with Sidebar
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },

  // Sidebar Styles
  sidebar: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },

  sidebarSection: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  sidebarSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  sidebarCategoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },

  sidebarCategoryItemActive: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },

  sidebarCategoryText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  sidebarCategoryTextActive: {
    color: '#10B981',
    fontWeight: '600',
  },

  sidebarCategoryCount: {
    fontSize: 12,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    textAlign: 'center',
  },

  sortItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },

  sortItemActive: {
    backgroundColor: '#ecfdf5',
  },

  sortText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  sortTextActive: {
    color: '#10B981',
    fontWeight: '600',
  },

  resetButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },

  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Main Content
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  mainScrollContent: {
    padding: 20,
  },

  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  productsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  productsCount: {
    fontSize: 14,
    color: '#64748b',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },

  // Compact Product Card
  compactProductCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: 280,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    marginBottom: 16,
  },

  compactImageContainer: {
    height: 140,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },

  compactProductImage: {
    width: '100%',
    height: '100%',
  },

  compactPlaceholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  compactPlaceholderIcon: {
    fontSize: 32,
  },

  compactStatusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },

  compactStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  compactProductInfo: {
    padding: 12,
  },

  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  compactProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },

  compactCategoryBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  compactCategoryText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },

  compactFarmerText: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 2,
  },

  compactFarmText: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
  },

  compactPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },

  compactPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },

  compactUnit: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 2,
  },

  compactMeta: {
    marginBottom: 12,
  },

  compactStockText: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 2,
  },

  compactDateText: {
    fontSize: 11,
    color: '#9ca3af',
  },

  compactActions: {
    flexDirection: 'row',
    gap: 8,
  },

  compactRejectButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
    minHeight: 36,
  },

  compactApproveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
    minHeight: 36,
  },

  compactRejectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  compactApproveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Mobile Sidebar Overlay
  mobileOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    flexDirection: 'row',
  },

  overlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  mobileSidebar: {
    width: 300,
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
  },

  closeSidebarButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 8,
  },

  closeSidebarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});