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
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getUserWithProfile } from '../services/auth';
import { Database } from '../types/database';

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
const ITEM_WIDTH = (width - 48) / 2; // 2 columns with margins

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

// StatCard Component
interface StatCardProps {
  title: string;
  value: string | number;
  color: string;
  backgroundColor?: string;
  icon: string;
  subtitle?: string;
  growth?: number;
  variant?: 'default' | 'bordered';
}

function StatCard({
  title,
  value,
  color,
  backgroundColor,
  icon,
  subtitle,
  growth,
  variant = 'default'
}: StatCardProps) {
  if (variant === 'bordered') {
    return (
      <View style={[styles.borderedStatCard, { borderLeftColor: color }]}>
        <View style={styles.borderedStatHeader}>
          <Text style={[styles.borderedStatIcon, { color }]}>{icon}</Text>
          <Text style={[styles.borderedStatValue, { color }]}>{value}</Text>
        </View>
        <Text style={styles.borderedStatTitle}>{title}</Text>
        {subtitle && <Text style={styles.borderedStatSubtitle}>{subtitle}</Text>}
        {growth !== undefined && (
          <Text style={[
            styles.growthText,
            { color: growth >= 0 ? '#16a34a' : '#dc2626' }
          ]}>
            {growth >= 0 ? '↗' : '↘'} {Math.abs(growth).toFixed(1)}%
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.statCard, backgroundColor ? { backgroundColor } : null]}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconContainer, { backgroundColor: color }]}>
          <Text style={styles.statIcon}>{icon}</Text>
        </View>
        <View style={styles.statContent}>
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
    </View>
  );
}

export default function Farm2GoFarmerProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadData();
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

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <View style={styles.logoSection}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F2G</Text>
          </View>
          <Text style={styles.brandText}>Farm2Go</Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/farmer/products/add')}
          >
            <Text style={styles.headerButtonText}>+ Add Product</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.profileButton}>
            <View style={styles.profileAvatar}>
              <Text style={styles.avatarText}>
                {profile?.first_name?.charAt(0)?.toUpperCase() || 'F'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search your products..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categorySection}
        contentContainerStyle={styles.categoryContainer}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.key}
            style={[
              styles.categoryTab,
              selectedCategory === category.key && styles.categoryTabActive
            ]}
            onPress={() => setSelectedCategory(category.key)}
          >
            <Text style={[
              styles.categoryText,
              selectedCategory === category.key && styles.categoryTextActive
            ]}>
              {category.label}
            </Text>
            {selectedCategory === category.key && (
              <View style={[styles.categoryIndicator, { backgroundColor: category.color }]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats Section with StatCards */}
      <View style={styles.statsSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsContainer}
        >
          <StatCard
            title="Total Products"
            value={products.length}
            color={colors.primary}
            backgroundColor={colors.white}
            icon="📦"
            variant="bordered"
          />
          
          <StatCard
            title="Live Products"
            value={products.filter(p => p.status === 'approved').length}
            color={colors.success}
            backgroundColor={colors.white}
            icon="✅"
            variant="bordered"
          />
          
          <StatCard
            title="Pending Review"
            value={products.filter(p => p.status === 'pending').length}
            color={colors.warning}
            backgroundColor={colors.white}
            icon="⏳"
            variant="bordered"
          />
          
          <StatCard
            title="Total Value"
            value={formatPrice(products.reduce((sum, p) => sum + (p.price * p.quantity_available), 0))}
            color={colors.secondary}
            backgroundColor={colors.white}
            icon="💰"
            variant="bordered"
          />
        </ScrollView>
      </View>
    </View>
  );

  const renderProductItem = ({ item, index }: { item: Product; index: number }) => (
    <TouchableOpacity
      style={[styles.productCard, index % 2 === 1 && styles.productCardRight]}
      onPress={() => router.push(`/farmer/products/${item.id}` as any)}
      activeOpacity={0.8}
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.productImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderIcon}>🥬</Text>
          </View>
        )}
        
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickActionIcon}>✏️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{formatPrice(item.price)}</Text>
          <Text style={styles.unit}>/{item.unit}</Text>
        </View>

        <View style={styles.productMeta}>
          <View style={styles.stockInfo}>
            <Text style={styles.stockText}>Stock: {item.quantity_available}</Text>
          </View>
          
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{item.category}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

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
      <FlatList
        data={filteredProducts}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id}
        numColumns={5}
        ListHeaderComponent={renderHeader}
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
        columnWrapperStyle={styles.row}
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
    paddingVertical: 12,
    paddingTop: 50, // Account for status bar
    backgroundColor: colors.primary,
  },
  
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  
  logoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  
  brandText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },
  
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  headerButton: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  
  headerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  profileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  avatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },

  // Search Section
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  filterIcon: {
    fontSize: 16,
  },

  // Categories
  categorySection: {
    backgroundColor: colors.white,
  },
  
  categoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    position: 'relative',
  },
  
  categoryTabActive: {
    backgroundColor: colors.primary + '20',
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
  
  categoryIndicator: {
    position: 'absolute',
    bottom: -2,
    left: '50%',
    transform: [{ translateX: -6 }],
    width: 12,
    height: 2,
    borderRadius: 1,
  },

  // Stats Section
  statsSection: {
    backgroundColor: colors.white,
    paddingBottom: 16,
  },
  
  statsContainer: {
    paddingHorizontal: 16,
  },

  // StatCard Styles
  statCard: {
    width: (width - 56) / 2,
    borderRadius: 18,
    padding: 20,
    marginRight: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  statHeader: {
    alignItems: 'center',
  },
  statIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  statContent: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  statTitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Bordered variant styles
  borderedStatCard: {
    width: (width - 64) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    borderLeftWidth: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  borderedStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  borderedStatIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  borderedStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  borderedStatTitle: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 4,
  },
  borderedStatSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    marginBottom: 8,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Product List
  listContent: {
    paddingBottom: 20,
  },
  
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
  },

  productCard: {
    width: '18%',
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  
  productCardRight: {
    // Already handled by gap in row style
  },
  
  imageContainer: {
    position: 'relative',
    aspectRatio: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
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
    fontSize: 20,
  },
  
  statusBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },

  statusText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: colors.white,
  },

  quickActions: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  quickAction: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActionIcon: {
    fontSize: 10,
  },
  
  productInfo: {
    padding: 6,
  },

  productName: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 12,
    marginBottom: 4,
  },

  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },

  price: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
  },

  unit: {
    fontSize: 8,
    color: colors.textSecondary,
    marginLeft: 1,
  },

  productMeta: {
    marginBottom: 4,
  },

  stockInfo: {
    marginBottom: 2,
  },

  stockText: {
    fontSize: 8,
    color: colors.textSecondary,
  },

  categoryBadge: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },

  categoryBadgeText: {
    fontSize: 7,
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