import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import HeaderComponent from '../components/HeaderComponent';
import { supabase } from '../lib/supabase';
import { getUserWithProfile } from '../services/auth';
import { Database } from '../types/database';

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
    barangay: string | null;
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

export default function MarketplaceLandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Wait for component to mount before navigation
  useEffect(() => {
    setIsMounted(true);
    loadUserProfile();
    loadProducts();
  }, []);

  // Handle authenticated user redirects
  useFocusEffect(
    useCallback(() => {
      if (isMounted && (Platform.OS === 'ios' || Platform.OS === 'android') && !isRedirecting && profile) {
        setIsRedirecting(true);

        // Add a small delay to ensure router is ready
        setTimeout(() => {
          // User is authenticated and has profile, redirect to appropriate dashboard
          console.log('User authenticated, redirecting to dashboard. User type:', profile.user_type);
          switch (profile.user_type) {
            case 'farmer':
              router.replace('/farmer/my-products');
              break;
            case 'admin':
              router.replace('/admin/users');
              break;
            case 'super-admin':
              router.replace('/super-admin');
              break;
            default:
              // Buyers stay on marketplace
              setIsRedirecting(false);
          }
        }, 100);
      }
    }, [isMounted, isRedirecting, profile])
  );

  const loadUserProfile = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        setProfile(userData.profile);
      }
    } catch (error) {
      console.log('No user session - showing marketplace as public');
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
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
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading products:', error);
        Alert.alert('Error', 'Failed to load products');
        return;
      }

      setProducts(data || []);
      setFilteredProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // If not mounted yet, show loading
  if (!isMounted) {
    return (
      <View style={styles.mobileLoading}>
        <Text style={styles.mobileLoadingTitle}>
          🌱 Farm2Go
        </Text>
        <Text style={styles.mobileLoadingSubtitle}>
          Loading...
        </Text>
      </View>
    );
  }
  // Filter products based on search and category
  useEffect(() => {
    let filtered = products;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(product =>
        product.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.profiles?.farm_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const handleProductPress = (product: Product) => {
    if (!profile) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to view product details and place orders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth/login') }
        ]
      );
      return;
    }
    router.push(`/buyer/product/${product.id}` as any);
  };

  const handleAddToCart = (product: Product) => {
    if (!profile) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to add items to cart.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth/login') }
        ]
      );
      return;
    }
    // Add to cart logic here
    Alert.alert('Success', `${product.name} added to cart!`);
  };

  const renderProductCard = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.productCard} onPress={() => handleProductPress(item)}>
      <View style={styles.productImageContainer}>
        <Image
          source={{ uri: 'https://via.placeholder.com/150x120/10b981/ffffff?text=Product' }}
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{item.category}</Text>
        </View>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.farmerInfo}>
          <Text style={styles.farmerName}>
            {item.profiles?.farm_name || `${item.profiles?.first_name} ${item.profiles?.last_name}`}
          </Text>
          <Text style={styles.farmerLocation}>{item.profiles?.barangay}</Text>
        </View>

        <View style={styles.productFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.productPrice}>₱{item.price.toFixed(2)}</Text>
            <Text style={styles.productUnit}>per {item.unit}</Text>
          </View>

          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={() => handleAddToCart(item)}
          >
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.availableQuantity}>
          {item.quantity_available} {item.unit}s available
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType={profile?.user_type || 'buyer'}
        currentRoute="/"
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search products, farms..."
        showCategories={true}
        categories={categories.map(cat => ({
          key: cat.toLowerCase(),
          label: cat,
          color: '#10b981'
        }))}
        selectedCategory={selectedCategory.toLowerCase()}
        onCategoryChange={(category) => setSelectedCategory(
          categories.find(cat => cat.toLowerCase() === category) || 'All'
        )}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading fresh products...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProductCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#10b981"
              colors={['#10b981']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No products match "${searchQuery}"`
                  : 'No products available at the moment'
                }
              </Text>
            </View>
          }
        />
      )}
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
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  productList: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    width: (width - 48) / 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  productImageContainer: {
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 16,
  },
  farmerInfo: {
    marginBottom: 8,
  },
  farmerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  farmerLocation: {
    fontSize: 10,
    color: '#9ca3af',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceContainer: {
    flex: 1,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  productUnit: {
    fontSize: 10,
    color: '#6b7280',
  },
  addToCartButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addToCartText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  availableQuantity: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  // Mobile Loading Styles
  mobileLoading: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileLoadingTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  mobileLoadingSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
});