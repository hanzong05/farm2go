import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import CategoryChip from '../../components/CategoryChip';
import NavBar from '../../components/NavBar';
import ProductCard from '../../components/ProductCard';
import SearchBar from '../../components/SearchBar';
import StatCard from '../../components/StatCard';
import { Theme } from '../../constants/Theme';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

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

const CATEGORIES = [
  { key: 'all', label: 'All', icon: '🌾' },
  { key: 'vegetables', label: 'Vegetables', icon: '🥬' },
  { key: 'fruits', label: 'Fruits', icon: '🍎' },
  { key: 'grains', label: 'Grains', icon: '🌾' },
  { key: 'herbs', label: 'Herbs', icon: '🌿' },
  { key: 'dairy', label: 'Dairy', icon: '🥛' },
];

export default function MyProductsScreenNew() {
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

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product =>
        product.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Filter by search query
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

  const getStats = () => {
    const approvedProducts = products.filter(p => p.status === 'approved').length;
    const pendingProducts = products.filter(p => p.status === 'pending').length;
    const totalValue = products
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + (p.price * p.quantity_available), 0);

    return {
      total: products.length,
      approved: approvedProducts,
      pending: pendingProducts,
      totalValue,
    };
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <ProductCard
      id={item.id}
      name={item.name}
      price={item.price}
      unit={item.unit}
      imageUrl={item.image_url}
      farmer={profile?.farm_name || `${profile?.first_name} ${profile?.last_name}`.trim()}
      onPress={() => router.push(`/farmer/products/${item.id}` as any)}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Text style={styles.emptyIcon}>🌱</Text>
      </View>

      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No products found' : 'Start your digital farm'}
      </Text>
      <Text style={styles.emptyDescription}>
        {searchQuery
          ? `No products match "${searchQuery}". Try a different search term.`
          : 'Add your first product to start selling fresh produce directly to customers.'
        }
      </Text>

      {!searchQuery && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/farmer/products/add')}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>+ Add Product</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const stats = getStats();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading your products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavBar currentRoute="/farmer/my-products" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Products</Text>
          <Text style={styles.headerSubtitle}>
            Manage your farm's inventory
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/farmer/products/add')}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <SearchBar
        placeholder="Search your products..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.primary}
            colors={[Theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.statsContainer}>
              <StatCard
                title="Total"
                value={stats.total}
                color={Theme.colors.primary}
                backgroundColor={Theme.colors.surface}
                icon="📊"
              />
              <StatCard
                title="Live"
                value={stats.approved}
                color={Theme.colors.success}
                backgroundColor={Theme.colors.surface}
                icon="✅"
              />
              <StatCard
                title="Pending"
                value={stats.pending}
                color={Theme.colors.warning}
                backgroundColor={Theme.colors.surface}
                icon="⏳"
              />
              <StatCard
                title="Value"
                value={formatPrice(stats.totalValue)}
                color={Theme.colors.secondary}
                backgroundColor={Theme.colors.surface}
                icon="💰"
              />
            </View>
          </ScrollView>
        </View>

        {/* Category Filter */}
        <View style={styles.categoriesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoriesContainer}>
              {CATEGORIES.map((category) => (
                <CategoryChip
                  key={category.key}
                  label={category.label}
                  icon={category.icon}
                  active={selectedCategory === category.key}
                  onPress={() => setSelectedCategory(category.key)}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Products Grid */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {filteredProducts.length > 0 ? `${filteredProducts.length} Products` : 'Products'}
            </Text>
          </View>

          {filteredProducts.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.productsGrid}>
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  unit={product.unit}
                  imageUrl={product.image_url}
                  farmer={profile?.farm_name || `${profile?.first_name} ${profile?.last_name}`.trim()}
                  onPress={() => router.push(`/farmer/products/${product.id}` as any)}
                  style={index % 2 === 0 ? styles.leftCard : styles.rightCard}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
  },

  loadingText: {
    marginTop: Theme.spacing.md,
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.lg,
    backgroundColor: Theme.colors.primary,
  },

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text.inverse,
    marginBottom: Theme.spacing.xs,
  },

  headerSubtitle: {
    ...Theme.typography.body2,
    color: Theme.colors.text.inverse,
    opacity: 0.8,
  },

  addButton: {
    width: 48,
    height: 48,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.text.inverse,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.md,
  },

  addButtonText: {
    ...Theme.typography.h3,
    color: Theme.colors.primary,
    fontWeight: 'bold',
  },

  scrollView: {
    flex: 1,
  },

  statsSection: {
    paddingVertical: Theme.spacing.md,
  },

  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },

  categoriesSection: {
    paddingVertical: Theme.spacing.sm,
  },

  categoriesContainer: {
    flexDirection: 'row',
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },

  productsSection: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.md,
  },

  sectionHeader: {
    marginBottom: Theme.spacing.md,
  },

  sectionTitle: {
    ...Theme.typography.h4,
    color: Theme.colors.text.primary,
  },

  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  leftCard: {
    marginRight: '2%',
  },

  rightCard: {
    marginLeft: '2%',
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.lg,
  },

  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },

  emptyIcon: {
    fontSize: 40,
  },

  emptyTitle: {
    ...Theme.typography.h4,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },

  emptyDescription: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Theme.spacing.xl,
  },

  ctaButton: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    ...Theme.shadows.md,
  },

  ctaText: {
    ...Theme.typography.button,
    color: Theme.colors.text.inverse,
    fontWeight: 'bold',
  },

  bottomSpacing: {
    height: Theme.spacing.xl,
  },
});