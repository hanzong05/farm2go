import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';
import ConfirmationModal from '../../components/ConfirmationModal';
import FilterSidebar from '../../components/FilterSidebar';
import HeaderComponent from '../../components/HeaderComponent';
import { applyFilters } from '../../utils/filterConfigs';

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
  image_url?: string;
}

type Profile = Database['public']['Tables']['profiles']['Row'];

const { width } = Dimensions.get('window');

// Responsive column calculation
const getNumColumns = () => {
  if (width >= 1024) return 4; // Desktop: 4 columns
  if (width >= 768) return 3;  // Tablet: 3 columns
  if (width >= 480) return 2;  // Large mobile: 2 columns
  return 1; // Small mobile: 1 column
};

const getItemWidth = (numColumns: number) => {
  const padding = 16; // Container padding
  const gap = 12; // Gap between items
  const totalGap = (numColumns - 1) * gap;
  return (width - (padding * 2) - totalGap) / numColumns;
};

// Farm2Go green color scheme
const colors = {
  primary: '#059669', // Farm green
  secondary: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  black: '#000000',
  gray100: '#f9fafb',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  background: '#f0f9f4',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#6b7280',
  border: '#d1fae5',
  shadow: 'rgba(0,0,0,0.1)',
};

const categories = [
  { key: 'all', label: 'All Products', color: colors.primary },
  { key: 'vegetables', label: 'Vegetables', color: '#059669' },
  { key: 'fruits', label: 'Fruits', color: '#16a34a' },
  { key: 'grains', label: 'Grains', color: '#ca8a04' },
  { key: 'herbs', label: 'Herbs', color: '#10b981' },
  { key: 'dairy', label: 'Dairy', color: '#0891b2' },
];

const isDesktop = width >= 1024;

export default function Farm2GoFarmerProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
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

  // Filter state - using centralized filter structure
  const [filterState, setFilterState] = useState({
    category: 'all',
    status: 'all',
    priceRange: 'all',
    sortBy: 'newest'
  });

  const [numColumns, setNumColumns] = useState(getNumColumns());

  useEffect(() => {
    loadData();

    // Listen for orientation changes
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setNumColumns(getNumColumns());
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, filterState]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        router.replace('/auth/login');
        return;
      }

      setProfile(userData.profile);

      const { data: productsData, error } = await (supabase as any)
        .from('products')
        .select('*')
        .eq('farmer_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setConfirmModal({
      visible: true,
      title: 'Edit Product?',
      message: `Do you want to edit "${product.name}"? You'll be taken to the edit page where you can modify product details.`,
      isDestructive: false,
      confirmText: 'Yes, Edit',
      onConfirm: () => {
        router.push(`/farmer/products/edit/${product.id}` as any);
        setConfirmModal(prev => ({ ...prev, visible: false }));
      }
    });
  };

  const filterProducts = () => {
    let filtered = products;

    // Filter by category
    if (filterState.category !== 'all') {
      filtered = filtered.filter(product =>
        product.category.toLowerCase() === filterState.category.toLowerCase()
      );
    }

    // Filter by status
    if (filterState.status !== 'all') {
      filtered = filtered.filter(product => product.status === filterState.status);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort products
    switch (filterState.sortBy) {
      case 'price-low':
        filtered = filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered = filtered.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'stock-low':
        filtered = filtered.sort((a, b) => a.quantity_available - b.quantity_available);
        break;
      case 'stock-high':
        filtered = filtered.sort((a, b) => b.quantity_available - a.quantity_available);
        break;
      case 'newest':
      default:
        filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    setFilteredProducts(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return colors.success;
      case 'pending': return colors.warning;
      case 'rejected': return colors.danger;
      default: return colors.gray500;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Live';
      case 'pending': return 'Review';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };


  const handleFilterChange = (key: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      {/* Categories */}
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Categories</Text>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.key}
            style={[
              styles.sidebarCategoryItem,
              filterState.category === category.key && styles.sidebarCategoryItemActive
            ]}
            onPress={() => handleFilterChange('category', category.key)}
          >
            <Text style={[
              styles.sidebarCategoryText,
              filterState.category === category.key && styles.sidebarCategoryTextActive
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

      {/* Status Filter */}
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Status</Text>
        {[
          { key: 'all', label: 'All Status' },
          { key: 'approved', label: 'Live Products' },
          { key: 'pending', label: 'Under Review' },
          { key: 'rejected', label: 'Rejected' }
        ].map((status) => (
          <TouchableOpacity
            key={status.key}
            style={[
              styles.sidebarCategoryItem,
              filterState.status === status.key && styles.sidebarCategoryItemActive
            ]}
            onPress={() => handleFilterChange('status', status.key)}
          >
            <Text style={[
              styles.sidebarCategoryText,
              filterState.status === status.key && styles.sidebarCategoryTextActive
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

      {/* Sort By */}
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarSectionTitle}>Sort By</Text>
        {[
          { key: 'newest', label: 'Newest First' },
          { key: 'price-low', label: 'Price: Low to High' },
          { key: 'price-high', label: 'Price: High to Low' },
          { key: 'name', label: 'Name A-Z' },
          { key: 'stock-low', label: 'Stock: Low to High' },
          { key: 'stock-high', label: 'Stock: High to Low' }
        ].map((sort) => (
          <TouchableOpacity
            key={sort.key}
            style={[
              styles.sortItem,
              filterState.sortBy === sort.key && styles.sortItemActive
            ]}
            onPress={() => handleFilterChange('sortBy', sort.key)}
          >
            <Text style={[
              styles.sortText,
              filterState.sortBy === sort.key && styles.sortTextActive
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
          setFilterState({
            category: 'all',
            status: 'all',
            priceRange: 'all',
            sortBy: 'newest'
          });
          setSearchQuery('');
        }}
      >
        <Text style={styles.resetButtonText}>Reset All Filters</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCompactProduct = (product: Product) => (
    <TouchableOpacity
      style={styles.compactProductCard}
      onPress={() => router.push(`/products/${product.id}` as any)}
      activeOpacity={0.8}
    >
      {/* Product Image */}
      <View style={styles.compactImageContainer}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.compactProductImage} />
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

        <View style={styles.compactPriceContainer}>
          <Text style={styles.compactPrice}>{formatPrice(product.price)}</Text>
          <Text style={styles.compactUnit}>/{product.unit}</Text>
        </View>

        <View style={styles.compactMeta}>
          <Text style={styles.compactStockText}>Stock: {product.quantity_available} {product.unit}</Text>
          <Text style={styles.compactDateText}>
            {new Date(product.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.compactActions}>
          <TouchableOpacity
            style={styles.compactEditButton}
            onPress={(e) => {
              e.stopPropagation();
              handleEditProduct(product);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.compactEditButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
    const itemWidth = getItemWidth(numColumns);
    const isDesktop = width >= 1024;
    const isTablet = width >= 768;
    const isMobile = width < 768;

    return (
      <TouchableOpacity
        style={[styles.productCard, { width: itemWidth }]}
        onPress={() => router.push(`/products/${item.id}` as any)}
        activeOpacity={0.8}
      >
        {/* Product Image */}
        <View style={[
          styles.imageContainer,
          { height: itemWidth * 0.8 } // Maintain aspect ratio
        ]}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.productImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={[
                styles.placeholderIcon,
                { fontSize: isDesktop ? 32 : isTablet ? 28 : 24 }
              ]}>🥬</Text>
            </View>
          )}
          
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={[
              styles.statusText,
              { fontSize: isDesktop ? 10 : isMobile ? 8 : 9 }
            ]}>
              {getStatusText(item.status)}
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={[
              styles.quickAction,
              { 
                width: isDesktop ? 28 : isMobile ? 20 : 24,
                height: isDesktop ? 28 : isMobile ? 20 : 24,
              }
            ]}>
              <Text style={[
                styles.quickActionIcon,
                { fontSize: isDesktop ? 14 : isMobile ? 10 : 12 }
              ]}>✏️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Product Info */}
        <View style={[
          styles.productInfo,
          { padding: isDesktop ? 12 : isMobile ? 8 : 10 }
        ]}>
          <Text style={[
            styles.productName,
            { 
              fontSize: isDesktop ? 14 : isMobile ? 12 : 13,
              lineHeight: isDesktop ? 18 : isMobile ? 16 : 17,
            }
          ]} numberOfLines={2}>
            {item.name}
          </Text>
          
          <View style={styles.priceContainer}>
            <Text style={[
              styles.price,
              { fontSize: isDesktop ? 16 : isMobile ? 13 : 14 }
            ]}>
              {formatPrice(item.price)}
            </Text>
            <Text style={[
              styles.unit,
              { fontSize: isDesktop ? 11 : isMobile ? 9 : 10 }
            ]}>
              /{item.unit}
            </Text>
          </View>

          <View style={styles.productMeta}>
            <View style={styles.stockInfo}>
              <Text style={[
                styles.stockText,
                { fontSize: isDesktop ? 11 : isMobile ? 9 : 10 }
              ]}>
                Stock: {item.quantity_available}
              </Text>
            </View>
            
            <View style={styles.categoryBadge}>
              <Text style={[
                styles.categoryBadgeText,
                { fontSize: isDesktop ? 9 : isMobile ? 8 : 8.5 }
              ]}>
                {item.category}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Text style={styles.emptyIcon}>🌱</Text>
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No products found' : 'Start selling on Farm2Go'}
      </Text>
      <Text style={styles.emptyDescription}>
        {searchQuery
          ? `No products match "${searchQuery}"`
          : 'Add your first product to start earning from your farm'
        }
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={styles.emptyAction}
          onPress={() => router.push('/farmer/products/add')}
        >
          <Text style={styles.emptyActionText}>+ Add Your First Product</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="farmer"
        currentRoute="/farmer/my-products"
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search your products..."
        showAddButton={true}
        addButtonText="+ Add Product"
        addButtonRoute="/farmer/products/add"
        showFilterButton={!isDesktop}
        onFilterPress={() => setShowSidebar(!showSidebar)}
        showMessages={true}
        showNotifications={true}
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
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* Products Header */}
            <View style={styles.productsHeader}>
              <Text style={styles.productsTitle}>
                My Products
              </Text>
              <Text style={styles.productsCount}>
                {filteredProducts.length} products found
              </Text>
            </View>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              renderEmptyState()
            ) : (
              <View style={styles.productsGrid}>
                {filteredProducts.map((product) => renderCompactProduct(product))}
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

          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.id}
            key={numColumns} // Force re-render when columns change
            numColumns={numColumns}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={null}
            columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
            showsVerticalScrollIndicator={false}
          />
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

      {/* Floating Add Product Button */}
      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={() => router.push('/farmer/products/add')}
        activeOpacity={0.8}
      >
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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


  // Product List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },

  productCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  
  imageContainer: {
    position: 'relative',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  placeholderIcon: {
    fontSize: 24,
  },
  
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },

  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.white,
  },

  quickActions: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  quickAction: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActionIcon: {
    fontSize: 12,
  },
  
  productInfo: {
    padding: 10,
  },

  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 17,
    marginBottom: 6,
  },

  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },

  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },

  unit: {
    fontSize: 10,
    color: colors.textSecondary,
    marginLeft: 2,
  },

  productMeta: {
    marginBottom: 4,
  },

  stockInfo: {
    marginBottom: 4,
  },

  stockText: {
    fontSize: 10,
    color: colors.textSecondary,
  },

  categoryBadge: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },

  categoryBadgeText: {
    fontSize: 8.5,
    color: colors.textSecondary,
    textTransform: 'capitalize',
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

  // Desktop Layout with Sidebar
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },

  // Sidebar Styles
  sidebar: {
    width: 280,
    backgroundColor: colors.white,
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
    color: colors.primary,
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
    color: colors.primary,
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
    color: colors.white,
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
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
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
    resizeMode: 'cover',
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
    color: colors.white,
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
    color: '#0f172a',
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

  compactPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },

  compactPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
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
    color: '#64748b',
    marginBottom: 2,
  },

  compactDateText: {
    fontSize: 11,
    color: '#9ca3af',
  },

  compactActions: {
    flexDirection: 'row',
  },

  compactEditButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },

  compactEditButtonText: {
    color: colors.white,
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
    backgroundColor: colors.white,
    paddingTop: 20,
  },

  closeSidebarButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 8,
  },

  closeSidebarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Floating Add Button
  floatingAddButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});