import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

// Responsive breakpoints
const isTablet = width >= 768;
const isDesktop = width >= 1024;

// Calculate number of columns based on screen width
const getNumColumns = () => {
  if (width < 768) {
    // Phone: 2 columns
    return 2;
  } else if (width < 1024) {
    // Tablet: 3 columns
    return 3;
  } else if (width < 1440) {
    // Small desktop: 4 columns
    return 4;
  } else {
    // Large desktop: 5 columns
    return 5;
  }
};

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
  farmer_id: string;
  image_url?: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
    barangay: string | null;
  };
}

type Profile = Database['public']['Tables']['profiles']['Row'];



export default function MarketplaceScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, searchQuery]);

  const loadData = async () => {
    try {
      // Get user profile
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        setProfile(userData.profile);
      }

      // Load approved products with farmer info
      const { data: productsData, error } = await supabase
        .from('products')
        .select(`
          *,
          profiles:farmer_id (
            first_name,
            last_name,
            farm_name,
            barangay
          )
        `)
        .eq('status', 'approved')
        .gt('quantity_available', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load marketplace data');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.profiles?.farm_name?.toLowerCase().includes(query)
      );
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
      currency: 'PHP'
    }).format(price);
  };

 


  const renderProduct = (product: Product) => (
    <TouchableOpacity
      key={product.id}
      style={styles.productCard}
      onPress={() => router.push(`/buyer/products/${product.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.productHeader}>
        <View style={styles.productMainInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{product.category}</Text>
          </View>
        </View>
        <View style={styles.farmerCard}>
          <Text style={styles.farmerIcon}>🏡</Text>
          <View style={styles.farmerInfo}>
            <Text style={styles.farmerName}>{product.profiles?.farm_name || 'Farm'}</Text>
            <Text style={styles.farmerLocation}>{product.profiles?.barangay}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.productDescription} numberOfLines={2}>
        {product.description}
      </Text>

      <View style={styles.productMetrics}>
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Price</Text>
          <Text style={styles.priceValue}>{formatPrice(product.price)}</Text>
          <Text style={styles.priceUnit}>per {product.unit}</Text>
        </View>
        
        <View style={styles.metricsVerticalDivider} />
        
        <View style={styles.stockSection}>
          <Text style={styles.stockLabel}>Available</Text>
          <Text style={styles.stockValue}>{product.quantity_available}</Text>
          <Text style={styles.stockUnit}>{product.unit}</Text>
        </View>
      </View>

      <View style={styles.productFooter}>
        <TouchableOpacity
          style={styles.contactButton}
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/buyer/contact-farmer/${product.farmer_id}` as any);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.contactButtonText}>Contact</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.orderButton}
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/buyer/order/${product.id}` as any);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.orderButtonText}>Order Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderGridProduct = (product: Product) => (
    <TouchableOpacity
      style={styles.gridProductCard}
      onPress={() => router.push(`/buyer/products/${product.id}` as any)}
      activeOpacity={0.8}
    >
      {/* Product Image */}
      <View style={styles.gridImageContainer}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.gridProductImage} />
        ) : (
          <View style={styles.gridPlaceholderImage}>
            <Text style={styles.gridPlaceholderIcon}>🥬</Text>
          </View>
        )}

        {/* Category Badge */}
        <View style={styles.gridCategoryBadge}>
          <Text style={styles.gridCategoryText}>{product.category}</Text>
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.gridProductInfo}>
        <Text style={styles.gridProductName} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.gridPriceContainer}>
          <Text style={styles.gridPrice}>{formatPrice(product.price)}</Text>
          <Text style={styles.gridUnit}>/{product.unit}</Text>
        </View>

        <View style={styles.gridProductMeta}>
          <View style={styles.gridFarmerInfo}>
            <Text style={styles.gridFarmerText} numberOfLines={1}>
              🏡 {product.profiles?.farm_name || 'Farm'}
            </Text>
          </View>

          <View style={styles.gridStockInfo}>
            <Text style={styles.gridStockText}>{product.quantity_available} {product.unit}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.gridOrderButton}
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/buyer/order/${product.id}` as any);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.gridOrderButtonText}>Order Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>🛒</Text>
        </View>
      </View>
      
      <Text style={styles.emptyTitle}>No Products Found</Text>
      <Text style={styles.emptyDescription}>
        {searchQuery
          ? `No products match "${searchQuery}"`
          : selectedCategory !== 'All'
          ? `No products available in ${selectedCategory} category`
          : 'No products available at the moment'}
      </Text>

      {(searchQuery || selectedCategory !== 'All') && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => {
            setSearchQuery('');
            setSelectedCategory('All');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <HeaderComponent
          profile={profile}
          showSearch={false}
        />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading fresh products...</Text>
        </View>
      </View>
    );
  }

  // Convert categories to match header component format
  const headerCategories = [
    { key: 'all', label: 'All', color: '#6b7280' },
    { key: 'vegetables', label: 'Vegetables', color: '#10b981' },
    { key: 'fruits', label: 'Fruits', color: '#f59e0b' },
    { key: 'grains', label: 'Grains', color: '#8b5cf6' },
    { key: 'herbs', label: 'Herbs', color: '#059669' },
    { key: 'dairy', label: 'Dairy', color: '#3b82f6' },
    { key: 'meat', label: 'Meat', color: '#dc2626' },
  ];

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search fresh products..."
        showCategories={true}
        categories={headerCategories}
        selectedCategory={selectedCategory.toLowerCase()}
        onCategoryChange={(category) => setSelectedCategory(category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1))}
        showFilterButton={true}
      />

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
    
        {/* Products Section */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === 'All' ? 'Fresh Products' : selectedCategory}
            </Text>
            <View style={styles.productCount}>
              <Text style={styles.productCountText}>
                {filteredProducts.length} products
              </Text>
            </View>
          </View>

          {filteredProducts.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={filteredProducts}
              renderItem={({ item }) => renderGridProduct(item)}
              keyExtractor={(item) => item.id}
              numColumns={getNumColumns()}
              columnWrapperStyle={getNumColumns() > 1 ? styles.gridRow : undefined}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              key={getNumColumns()} // Force re-render when columns change
            />
          )}
        </View>
      </ScrollView>
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
    backgroundColor: '#f1f5f9',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

  // Search Section
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 12,
    color: '#64748b',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  clearSearchButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 'bold',
  },

  // Category Section
  categorySection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  categoryContainer: {
    paddingRight: 20,
    gap: 12,
  },
  categoryButton: {
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
  categoryButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
    elevation: 4,
    shadowOpacity: 0.15,
  },
  categoryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryButtonTextActive: {
    color: '#ffffff',
  },


  // Products Section
  productsSection: {
    paddingHorizontal: width < 768 ? 16 : 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  productCount: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  productCountText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
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
    marginBottom: 16,
  },
  productMainInfo: {
    flex: 1,
    marginRight: 16,
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    lineHeight: 26,
  },
  categoryBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  categoryBadgeText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  farmerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  farmerIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  farmerInfo: {
    alignItems: 'flex-start',
  },
  farmerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  farmerLocation: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  productDescription: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 20,
  },
  productMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  priceSection: {
    flex: 1,
    alignItems: 'center',
  },
  stockSection: {
    flex: 1,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stockLabel: {
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
  priceUnit: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  stockUnit: {
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
  productFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
    elevation: 2,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  contactButtonText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  orderButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  orderButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.3,
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
    backgroundColor: '#10b981',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  ctaText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },

  // Grid Layout Styles
  gridRow: {
    justifyContent: width < 768 ? 'space-around' : 'space-between',
    paddingHorizontal: width < 768 ? 4 : 8,
    marginBottom: 0,
  },
  gridProductCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: width < 768 ? '47%' : width < 1024 ? '31%' : width < 1440 ? '23%' : '18%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    marginBottom: 12,
  },
  gridImageContainer: {
    position: 'relative',
    aspectRatio: 1,
    backgroundColor: '#f8fafc',
  },
  gridProductImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gridPlaceholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridPlaceholderIcon: {
    fontSize: width < 768 ? 24 : 20,
  },
  gridCategoryBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#10b981',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
  },
  gridCategoryText: {
    fontSize: width < 768 ? 8 : 7,
    color: '#ffffff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  gridProductInfo: {
    padding: width < 768 ? 8 : 6,
  },
  gridProductName: {
    fontSize: width < 768 ? 12 : 10,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
    lineHeight: width < 768 ? 14 : 12,
  },
  gridPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  gridPrice: {
    fontSize: width < 768 ? 13 : 11,
    fontWeight: 'bold',
    color: '#059669',
  },
  gridUnit: {
    fontSize: width < 768 ? 10 : 8,
    color: '#64748b',
    marginLeft: 1,
  },
  gridProductMeta: {
    marginBottom: 6,
  },
  gridFarmerInfo: {
    marginBottom: 2,
  },
  gridFarmerText: {
    fontSize: width < 768 ? 10 : 8,
    color: '#64748b',
    fontWeight: '500',
  },
  gridStockInfo: {
    alignItems: 'flex-start',
  },
  gridStockText: {
    fontSize: width < 768 ? 10 : 8,
    color: '#6b7280',
    fontWeight: '500',
  },
  gridOrderButton: {
    backgroundColor: '#10b981',
    paddingVertical: width < 768 ? 6 : 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  gridOrderButtonText: {
    color: '#ffffff',
    fontSize: width < 768 ? 11 : 9,
    fontWeight: '600',
  },
});