import { router } from 'expo-router';
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
import ConfirmationModal from '../../components/ConfirmationModal';
import FilterSidebar, { FilterSection, FilterState } from '../../components/FilterSidebar';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { notifyAllAdmins, notifyUserAction } from '../../services/notifications';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

type Product = Database['public']['Tables']['products']['Row'] & {
  farmer_profile?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
    barangay: string | null;
  };
};

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    status: 'all',
    category: 'all',
    sort: 'newest'
  });
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

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const isMobile = width < 768;

  useEffect(() => {
    loadProfile();
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, filterState]);

  const loadProfile = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        setProfile(userData.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const filterProducts = () => {
    let filtered = products;

    // Filter by status
    if (filterState.status !== 'all') {
      filtered = filtered.filter(product => product.status === filterState.status);
    }

    // Filter by category
    if (filterState.category !== 'all') {
      filtered = filtered.filter(product => product.category.toLowerCase() === filterState.category);
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
    switch (filterState.sort) {
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

      // Load products with farmer info, filtered by barangay
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          farmer_profile:profiles!products_farmer_id_fkey(
            first_name,
            last_name,
            farm_name,
            barangay
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter products by admin's barangay
      let filteredData = data || [];
      if (userData.profile.barangay) {
        filteredData = filteredData.filter(product =>
          product.farmer_profile?.barangay === userData.profile.barangay
        );
      }

      setProducts(filteredData);
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

    const isApproval = action === 'approved';

    setConfirmModal({
      visible: true,
      title: `${isApproval ? 'Approve' : 'Reject'} Product?`,
      message: `Are you sure you want to ${isApproval ? 'approve' : 'reject'} "${product?.name}" by ${farmerName}?`,
      isDestructive: !isApproval,
      confirmText: `Yes, ${isApproval ? 'Approve' : 'Reject'}`,
      onConfirm: () => {
        updateProductStatus(productId, action);
        setConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const updateProductStatus = async (productId: string, status: 'approved' | 'rejected') => {
    try {
      setProcessing(productId);

      // Get product details before update for notifications
      const product = products.find(p => p.id === productId);
      if (!product) {
        Alert.alert('Error', 'Product not found');
        return;
      }

      const { error } = await supabase
        .from('products')
        .update({ status } as any)
        .eq('id', productId);

      if (error) throw error;

      // Send notifications
      try {
        // Notify the farmer whose product was updated
        await notifyUserAction(
          product.farmer_id,
          status,
          'product',
          product.name,
          profile?.id || '',
          `Product ${status} by administrator`
        );

        // Notify all other admins about the product action
        await notifyAllAdmins(
          `Product ${status === 'approved' ? 'Approved' : 'Rejected'}`,
          `Admin ${profile?.first_name} ${profile?.last_name} ${status} the product "${product.name}" by ${product.farmer_profile?.first_name} ${product.farmer_profile?.last_name}`,
          profile?.id || '',
          {
            action: `product_${status}`,
            productName: product.name,
            farmerId: product.farmer_id,
            farmerName: `${product.farmer_profile?.first_name} ${product.farmer_profile?.last_name}`
          }
        );

        console.log('✅ Notifications sent for product status update');
      } catch (notifError) {
        console.error('⚠️ Failed to send notifications:', notifError);
      }

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

  const openProductDetails = (product: Product) => {
    router.push(`/products/${product.id}` as any);
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

  const getFilterSections = (): FilterSection[] => [
    {
      key: 'status',
      title: 'Status',
      type: 'category',
      options: [
        { key: 'all', label: 'All Status', count: products.length },
        { key: 'pending', label: 'Pending Review', count: products.filter(p => p.status === 'pending').length },
        { key: 'approved', label: 'Approved', count: products.filter(p => p.status === 'approved').length },
        { key: 'rejected', label: 'Rejected', count: products.filter(p => p.status === 'rejected').length }
      ]
    },
    {
      key: 'category',
      title: 'Categories',
      type: 'category',
      options: [
        { key: 'all', label: 'All Categories', count: products.length },
        { key: 'vegetables', label: 'Vegetables', count: products.filter(p => p.category.toLowerCase() === 'vegetables').length },
        { key: 'fruits', label: 'Fruits', count: products.filter(p => p.category.toLowerCase() === 'fruits').length },
        { key: 'grains', label: 'Grains', count: products.filter(p => p.category.toLowerCase() === 'grains').length },
        { key: 'herbs', label: 'Herbs', count: products.filter(p => p.category.toLowerCase() === 'herbs').length },
        { key: 'dairy', label: 'Dairy', count: products.filter(p => p.category.toLowerCase() === 'dairy').length },
        { key: 'meat', label: 'Meat', count: products.filter(p => p.category.toLowerCase() === 'meat').length }
      ]
    },
    {
      key: 'sort',
      title: 'Sort By',
      type: 'sort',
      options: [
        { key: 'newest', label: 'Newest First' },
        { key: 'name', label: 'Name A-Z' },
        { key: 'farmer', label: 'Farmer Name' },
        { key: 'price-low', label: 'Price: Low to High' },
        { key: 'price-high', label: 'Price: High to Low' }
      ]
    }
  ];

  const resetFilters = () => {
    setFilterState({
      status: 'all',
      category: 'all',
      sort: 'newest'
    });
    setSearchQuery('');
  };

  const renderResetButton = () => (
    <TouchableOpacity
      style={styles.resetButton}
      onPress={resetFilters}
    >
      <Text style={styles.resetButtonText}>Reset All Filters</Text>
    </TouchableOpacity>
  );

  const renderCompactProduct = (product: Product) => {
    const farmerName = product.farmer_profile ?
      `${product.farmer_profile.first_name} ${product.farmer_profile.last_name}` :
      'Unknown Farmer';

    const isProcessing = processing === product.id;

    return (
      <TouchableOpacity
        style={styles.compactProductCard}
        onPress={() => openProductDetails(product)}
        activeOpacity={0.8}
      >
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
      </TouchableOpacity>
    );
  };

  const renderProduct = (product: Product) => {
    const farmerName = product.farmer_profile ?
      `${product.farmer_profile.first_name} ${product.farmer_profile.last_name}` :
      'Unknown Farmer';

    const farmName = product.farmer_profile?.farm_name;
    const isProcessing = processing === product.id;

    return (
      <TouchableOpacity
        key={product.id}
        style={styles.productCard}
        onPress={() => openProductDetails(product)}
        activeOpacity={0.8}
      >
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
      </TouchableOpacity>
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
        profile={profile}
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search products, farmers..."
        showFilterButton={!isDesktop}
        onFilterPress={() => setShowSidebar(!showSidebar)}
        showNotifications={true}
      />

      {/* Desktop Layout with Sidebar */}
      {isDesktop ? (
        <View style={styles.desktopLayout}>
          {/* Sidebar */}
          <View style={styles.sidebarContainer}>
            <FilterSidebar
              sections={getFilterSections()}
              filterState={filterState}
              onFilterChange={handleFilterChange}
              title="Product Filters"
            />
            {renderResetButton()}
          </View>

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
          {/* Mobile Sidebar */}
          <FilterSidebar
            sections={getFilterSections()}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            showMobile={showSidebar}
            onCloseMobile={() => setShowSidebar(false)}
            title="Product Filters"
          />

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

      <ConfirmationModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />
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

  // Sidebar Container
  sidebarContainer: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    paddingBottom: 20,
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

});