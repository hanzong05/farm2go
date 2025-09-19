import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';
import HeaderComponent from '../../components/HeaderComponent';

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

export default function Farm2GoFarmerProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
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
  }, [products, searchQuery, selectedCategory]);

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

  const filterProducts = () => {
    let filtered = products;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product =>
        product.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())
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


  const renderProductItem = ({ item, index }: { item: Product; index: number }) => {
    const itemWidth = getItemWidth(numColumns);
    const isDesktop = width >= 1024;
    const isTablet = width >= 768;
    const isMobile = width < 768;

    return (
      <TouchableOpacity
        style={[styles.productCard, { width: itemWidth }]}
        onPress={() => router.push(`/farmer/products/${item.id}` as any)}
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
        showCategories={true}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        showAddButton={true}
        addButtonText="+ Add Product"
        addButtonRoute="/farmer/products/add"
        showFilterButton={true}
        showMessages={true}
        showNotifications={true}
      />

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
});