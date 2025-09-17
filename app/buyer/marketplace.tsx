import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Dimensions, TextInput } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile, logoutUser } from '../../services/auth';
import { Database } from '../../types/database';
import NavBar from '../../components/NavBar';

const { width } = Dimensions.get('window');

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
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
    farm_location: string | null;
  };
}

type Profile = Database['public']['Tables']['profiles']['Row'];

const categories = [
  'All',
  'Vegetables',
  'Fruits',
  'Grains',
  'Herbs',
  'Dairy',
  'Meat',
  'Others'
];

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
            farm_location
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

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(price);
  };

  const renderCategoryFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryContainer}
      contentContainerStyle={styles.categoryContent}
    >
      {categories.map((category) => (
        <TouchableOpacity
          key={category}
          style={[
            styles.categoryButton,
            selectedCategory === category && styles.categoryButtonActive
          ]}
          onPress={() => setSelectedCategory(category)}
        >
          <Text style={[
            styles.categoryButtonText,
            selectedCategory === category && styles.categoryButtonTextActive
          ]}>
            {category}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderProduct = (product: Product) => (
    <TouchableOpacity
      key={product.id}
      style={styles.productCard}
      onPress={() => router.push(`/buyer/products/${product.id}` as any)}
    >
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productCategory}>{product.category}</Text>
        </View>
        <View style={styles.farmerInfo}>
          <Text style={styles.farmerName}>{product.profiles?.farm_name}</Text>
          <Text style={styles.farmerLocation}>{product.profiles?.farm_location}</Text>
        </View>
      </View>

      <Text style={styles.productDescription} numberOfLines={2}>
        {product.description}
      </Text>

      <View style={styles.productDetails}>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          <Text style={styles.unit}>per {product.unit}</Text>
        </View>
        <View style={styles.quantityContainer}>
          <Text style={styles.quantity}>{product.quantity_available}</Text>
          <Text style={styles.quantityLabel}>{product.unit} available</Text>
        </View>
      </View>

      <View style={styles.productFooter}>
        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => router.push(`/buyer/contact-farmer/${product.farmer_id}` as any)}
        >
          <Text style={styles.contactButtonText}>Contact Farmer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.orderButton}
          onPress={() => router.push(`/buyer/order/${product.id}` as any)}
        >
          <Text style={styles.orderButtonText}>Order Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading marketplace...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavBar currentRoute="/buyer/marketplace" />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products, farms, categories..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Category Filter */}
        {renderCategoryFilter()}

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/buyer/orders')}
          >
            <Text style={styles.actionButtonText}>My Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/buyer/favorites')}
          >
            <Text style={styles.actionButtonText}>Favorites</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/buyer/farmers')}
          >
            <Text style={styles.actionButtonText}>Find Farmers</Text>
          </TouchableOpacity>
        </View>

        {/* Products List */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === 'All' ? 'All Products' : selectedCategory}
            </Text>
            <Text style={styles.productCount}>
              {filteredProducts.length} products
            </Text>
          </View>

          {filteredProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? `No products match "${searchQuery}"`
                  : selectedCategory !== 'All'
                  ? `No products in ${selectedCategory} category`
                  : 'No products available at the moment'
                }
              </Text>
              {(searchQuery || selectedCategory !== 'All') && (
                <TouchableOpacity
                  style={styles.clearFiltersButton}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                  }}
                >
                  <Text style={styles.clearFiltersText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.productsList}>
              {filteredProducts.map(renderProduct)}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#1f2937',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#d1d5db',
    marginBottom: 8,
    fontWeight: '500',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  buyerName: {
    fontSize: 18,
    color: '#10b981',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  content: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -15,
    paddingTop: 24,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    color: '#111827',
  },
  categoryContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  categoryContent: {
    paddingRight: 24,
  },
  categoryButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
  },
  categoryButtonTextActive: {
    color: '#ffffff',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
  },
  productsSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  productCount: {
    fontSize: 15,
    color: '#10b981',
    fontWeight: '600',
  },
  productsList: {
    gap: 20,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 28,
  },
  productCategory: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  farmerInfo: {
    alignItems: 'flex-end',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  farmerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  farmerLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  productDescription: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 16,
  },
  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10b981',
  },
  unit: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  quantityContainer: {
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quantity: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  quantityLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '500',
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
  },
  contactButtonText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 15,
  },
  orderButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  orderButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    maxWidth: 280,
  },
  clearFiltersButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  clearFiltersText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});