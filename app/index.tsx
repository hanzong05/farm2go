import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/FontAwesome5';
import FilterSidebar from '../components/FilterSidebar';
import HeaderComponent from '../components/HeaderComponent';
import { supabase } from '../lib/supabase';
import { getUserWithProfile } from '../services/auth';
import { Database } from '../types/database';
import { applyFilters, getMarketplaceFilters } from '../utils/filterConfigs';
import { visualSearchService } from '../services/visualSearch';

const { width } = Dimensions.get('window');

// Responsive breakpoints
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Category counts from database
  const [categoryCounts, setCategoryCounts] = useState({
    all: 0,
    vegetables: 0,
    fruits: 0,
    grains: 0,
    herbs: 0,
  });

  // Visual search state
  const [showVisualSearchModal, setShowVisualSearchModal] = useState(false);
  const [visualSearchImage, setVisualSearchImage] = useState<string | null>(null);
  const [visualSearching, setVisualSearching] = useState(false);
  const [visualSearchResults, setVisualSearchResults] = useState<any>(null);

  // Filter state
  const [filterState, setFilterState] = useState({
    category: 'all',
    priceRange: 'all',
    availability: false,
    sortBy: 'newest'
  });

  useEffect(() => {
    loadData();
  }, []);

  // Reload data when profile changes (after OAuth)
  useEffect(() => {
    if (profile) {
      console.log('📍 Profile loaded, refreshing marketplace data');
      loadData();
    }
  }, [profile]);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, filterState]);

  const fetchCategoryCounts = async () => {
    try {
      // Fetch count for each category
      const categories = ['vegetables', 'fruits', 'grains', 'herbs'];
      const counts: any = {};

      // Get total count
      const { count: totalCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gt('quantity_available', 0);

      counts.all = totalCount || 0;

      // Get count for each category
      for (const category of categories) {
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved')
          .eq('category', category)
          .gt('quantity_available', 0);

        counts[category] = count || 0;
      }

      setCategoryCounts(counts);
    } catch (error) {
      console.error('Error fetching category counts:', error);
    }
  };

  const loadData = async (page = 0, pageSize = 20, append = false) => {
    try {
      // Get user profile and check permissions
      if (!profile) {
        try {
          const userData = await getUserWithProfile();
          if (userData?.profile) {
            setProfile(userData.profile);

            // Redirect admins and super-admins to admin users page
            if (userData.profile.user_type === 'admin' || userData.profile.user_type === 'super-admin') {
              console.log('🔒 Redirecting admin to admin users page - marketplace is for farmers and buyers only');
              router.replace('/admin/users');
              return;
            }
          }
        } catch (error) {
          // Marketplace is public for farmers and buyers, require authentication
          console.log('🔒 Marketplace: Authentication required, redirecting to login');
          router.replace('/auth/login');
          return;
        }
      }

      // Check if current profile should be redirected (admins should not access marketplace)
      if (profile && (profile.user_type === 'admin' || profile.user_type === 'super-admin')) {
        console.log('🔒 Redirecting admin to admin users page - marketplace is for farmers and buyers only');
        router.replace('/admin/users');
        return;
      }

      // Fetch category counts only on initial load (not when loading more)
      if (!append) {
        await fetchCategoryCounts();
      }

      // Load approved products with farmer info using pagination
      const { data: productsData, error } = await supabase
        .from('products')
        .select(`
          id, name, description, price, unit, quantity_available, category, image_url, farmer_id,
          profiles:farmer_id (
            first_name,
            last_name,
            farm_name,
            barangay
          )
        `)
        .eq('status', 'approved')
        .gt('quantity_available', 0)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .limit(pageSize);

      if (error) throw error;

      // Update products list
      if (append) {
        setProducts(prev => [...prev, ...(productsData || [])]);
      } else {
        setProducts(productsData || []);
      }

      // Check if there are more products
      setHasMore((productsData || []).length === pageSize);

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load marketplace data');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreProducts = async () => {
    if (loadingMore || !hasMore || searchQuery.trim()) return;

    setLoadingMore(true);
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await loadData(nextPage, 20, true);
  };

  const filterProducts = async () => {
    // If there's a search query, search from database
    if (searchQuery.trim()) {
      try {
        const query = searchQuery.toLowerCase();

        // Search from database with all matching products
        const { data: searchResults, error } = await supabase
          .from('products')
          .select(`
            id, name, description, price, unit, quantity_available, category, image_url, farmer_id,
            profiles:farmer_id (
              first_name,
              last_name,
              farm_name,
              barangay
            )
          `)
          .eq('status', 'approved')
          .gt('quantity_available', 0)
          .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        let filtered: Product[] = searchResults || [];

        // Also filter by farm name locally (since it's in joined table)
        filtered = filtered.filter(product =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query) ||
          product.profiles?.farm_name?.toLowerCase().includes(query)
        );

        // Apply other filters
        filtered = applyFilters(filtered, filterState, {
          categoryKey: 'category',
          priceKey: 'price',
          dateKey: 'created_at',
          customFilters: {
            availability: (product, value) => value ? product.quantity_available > 0 : true,
          }
        });

        setFilteredProducts(filtered);
      } catch (error) {
        console.error('Search error:', error);
        // Fallback to local filtering
        let filtered = products.filter(product =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.profiles?.farm_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );

        filtered = applyFilters(filtered, filterState, {
          categoryKey: 'category',
          priceKey: 'price',
          dateKey: 'created_at',
          customFilters: {
            availability: (product, value) => value ? product.quantity_available > 0 : true,
          }
        });

        setFilteredProducts(filtered);
      }
    } else {
      // No search query - filter from loaded products
      let filtered = products;

      // Apply filters using the utility function
      filtered = applyFilters(filtered, filterState, {
        categoryKey: 'category',
        priceKey: 'price',
        dateKey: 'created_at',
        customFilters: {
          availability: (product, value) => value ? product.quantity_available > 0 : true,
        }
      });

      setFilteredProducts(filtered);
    }
  };

  // Handle filter changes
  const handleFilterChange = (key: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      [key]: value
    }));
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

  const checkAuthAndNavigate = (route: string) => {
    if (!profile) {
      // User is not logged in, redirect to login
      router.push('/auth/login');
      return;
    }
    // User is logged in, proceed with navigation
    router.push(route as any);
  };

  // Visual Search Functions
  const handleVisualSearch = async () => {
    try {
      // Show instruction before opening gallery
      Alert.alert(
        'Visual Search Tips',
        'For best results:\n• Take a clear, well-lit photo\n• Focus on one main product\n• Avoid blurry or dark images',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              // Request permissions
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant camera roll permissions to use visual search.');
                return;
              }

              // Launch image picker
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
              });

              if (!result.canceled && result.assets[0].base64) {
                setVisualSearchImage(result.assets[0].uri);
                setShowVisualSearchModal(true);
                await performVisualSearch(result.assets[0].base64);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleTakePhoto = async () => {
    try {
      // Show instruction before opening camera
      Alert.alert(
        'Visual Search Tips',
        'For best results:\n• Take a clear, well-lit photo\n• Focus on one main product\n• Avoid blurry or dark images',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              // Request camera permissions
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant camera permissions to use visual search.');
                return;
              }

              // Launch camera
              const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
              });

              if (!result.canceled && result.assets[0].base64) {
                setVisualSearchImage(result.assets[0].uri);
                setShowVisualSearchModal(true);
                await performVisualSearch(result.assets[0].base64);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const performVisualSearch = async (imageBase64: string) => {
    try {
      setVisualSearching(true);

      // Analyze image with Clarifai API
      const results = await visualSearchService.analyzeImage(imageBase64);
      setVisualSearchResults(results);

      // Close modal immediately after analysis - show scanning animation on main screen
      setShowVisualSearchModal(false);

      // Only allow specific farm categories (strict filtering - no chocolate!)
      const allowedCategories = ['vegetables', 'fruits', 'grains', 'herbs', 'dairy', 'meat'];
      const hasFarmCategory = results.categories.some(cat => allowedCategories.includes(cat));

      // Also check for specific farm product keywords in labels
      const farmProductKeywords = ['tomato', 'carrot', 'lettuce', 'cabbage', 'pepper', 'onion',
                                   'potato', 'cucumber', 'eggplant', 'broccoli', 'spinach',
                                   'apple', 'banana', 'orange', 'mango', 'grape', 'strawberry',
                                   'rice', 'corn', 'wheat', 'oat', 'grain',
                                   'basil', 'mint', 'parsley', 'ginger', 'garlic',
                                   'milk', 'egg', 'cheese', 'chicken', 'fish', 'meat'];

      const hasFarmProduct = results.labels.some(label =>
        farmProductKeywords.some(keyword => label.includes(keyword))
      );

      if (!hasFarmCategory && !hasFarmProduct) {
        Alert.alert(
          'No Products Found',
          'Please try again with a clearer image.'
        );
        setVisualSearching(false);
        return;
      }

      // Filter products based on visual search results
      const scoredProducts = products
        .map(product => ({
          ...product,
          similarityScore: visualSearchService.calculateSimilarityScore(results, {
            name: product.name,
            description: product.description,
            category: product.category,
          }),
        }))
        .filter(p => p.similarityScore > 5) // Lower threshold to find more matching products
        .sort((a, b) => b.similarityScore - a.similarityScore);

      setFilteredProducts(scoredProducts);

      // Also update search query with detected labels
      if (results.labels.length > 0) {
        setSearchQuery(results.labels[0]);
      }

      // Update category filter if detected
      if (results.categories.length > 0) {
        setFilterState(prev => ({
          ...prev,
          category: results.categories[0],
        }));
      }

    } catch (error) {
      console.error('Visual search error:', error);
      Alert.alert(
        'Visual Search Error',
        'Failed to analyze image. Please try again.'
      );
    } finally {
      setVisualSearching(false);
    }
  };

  const closeVisualSearchModal = () => {
    setShowVisualSearchModal(false);
    setVisualSearchImage(null);
    setVisualSearchResults(null);
  };




  const renderCompactProduct = (product: Product) => (
    <TouchableOpacity
      key={product.id}
      style={styles.compactProductCard}
      onPress={() => checkAuthAndNavigate(`/products/${product.id}`)}
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
          <Text style={styles.compactFarmerText} numberOfLines={1}>
            🏡 {product.profiles?.farm_name || 'Farm'}
          </Text>
          <Text style={styles.compactStockText}>{product.quantity_available} {product.unit} left</Text>
        </View>

      </View>
    </TouchableOpacity>
  );

  const renderGridProduct = (product: Product) => (
    <TouchableOpacity
      key={product.id}
      style={styles.gridProductCard}
      onPress={() => checkAuthAndNavigate(`/products/${product.id}`)}
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

      </View>
    </TouchableOpacity>
  );

  // Get filter configuration with database category counts
  const filterSections = getMarketplaceFilters(products, categoryCounts);

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
          : filterState.category !== 'all'
          ? `No products available in ${filterState.category} category`
          : 'No products available at the moment'}
      </Text>

      {(searchQuery || filterState.category !== 'all') && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => {
            setSearchQuery('');
            setFilterState({
              category: 'all',
              priceRange: 'all',
              availability: false,
              sortBy: 'newest'
            });
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
        selectedCategory={filterState.category}
        onCategoryChange={(category) => handleFilterChange('category', category)}
        showFilterButton={!isDesktop}
        onFilterPress={() => setShowSidebar(!showSidebar)}
        showMessages={true}
        showNotifications={true}
      />

      {/* Desktop Layout with Sidebar */}
      {isDesktop ? (
        <View style={styles.desktopLayout}>
          {/* Sidebar */}
          <FilterSidebar
            sections={filterSections}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            title="Product Filters"
          />

          {/* Main Content */}
          <ScrollView
            style={styles.mainContent}
            contentContainerStyle={styles.mainScrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#10b981"
                colors={['#10b981']}
              />
            }
            showsVerticalScrollIndicator={false}
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
              if (isCloseToBottom && !loadingMore && hasMore && !searchQuery.trim()) {
                loadMoreProducts();
              }
            }}
            scrollEventThrottle={400}
          >
            {/* Products Header */}
            <View style={styles.productsHeader}>
              <Text style={styles.productsTitle}>
                {filterState.category === 'all' ? 'All Products' : filterState.category.charAt(0).toUpperCase() + filterState.category.slice(1)}
              </Text>
              <Text style={styles.productsCount}>
                {filteredProducts.length} products found
              </Text>
            </View>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                <View style={styles.productsGrid}>
                  {filteredProducts.map((product) => renderCompactProduct(product))}
                </View>

                {/* Load More Indicator */}
                {loadingMore && (
                  <View style={styles.loadMoreContainer}>
                    <ActivityIndicator size="small" color="#10b981" />
                    <Text style={styles.loadMoreText}>Loading more products...</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      ) : (
        /* Mobile/Tablet Layout */
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
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
            if (isCloseToBottom && !loadingMore && hasMore && !searchQuery.trim()) {
              loadMoreProducts();
            }
          }}
          scrollEventThrottle={400}
        >
          {/* Mobile Filter Sidebar */}
          <FilterSidebar
            sections={filterSections}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            title="Product Filters"
            showMobile={showSidebar}
            onCloseMobile={() => setShowSidebar(false)}
          />

          {/* Products Section */}
          <View style={styles.productsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {filterState.category === 'all' ? 'Fresh Products' : filterState.category.charAt(0).toUpperCase() + filterState.category.slice(1)}
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
              <>
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

                {/* Load More Indicator */}
                {loadingMore && (
                  <View style={styles.loadMoreContainer}>
                    <ActivityIndicator size="small" color="#10b981" />
                    <Text style={styles.loadMoreText}>Loading more products...</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* Floating Visual Search Button */}
      <TouchableOpacity
        style={styles.visualSearchFab}
        onPress={handleVisualSearch}
        activeOpacity={0.8}
      >
        <Icon name="camera" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Visual Search Modal */}
      <Modal
        visible={showVisualSearchModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeVisualSearchModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Visual Search</Text>
              <TouchableOpacity onPress={closeVisualSearchModal}>
                <Icon name="times" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {visualSearchImage && (
              <View style={styles.searchImageContainer}>
                <Image
                  source={{ uri: visualSearchImage }}
                  style={styles.searchImage}
                  resizeMode="cover"
                />
                {visualSearching && (
                  <View style={styles.searchingOverlay}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.searchingText}>Analyzing image...</Text>
                  </View>
                )}
              </View>
            )}

            {visualSearchResults && !visualSearching && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsTitle}>Detected:</Text>
                <View style={styles.labelsContainer}>
                  {visualSearchResults.labels.slice(0, 5).map((label: string, index: number) => (
                    <View key={index} style={styles.labelBadge}>
                      <Text style={styles.labelText}>{label}</Text>
                    </View>
                  ))}
                </View>

                {visualSearchResults.categories.length > 0 && (
                  <>
                    <Text style={styles.resultsTitle}>Categories:</Text>
                    <View style={styles.labelsContainer}>
                      {visualSearchResults.categories.map((category: string, index: number) => (
                        <View key={index} style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{category}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.resultsInfo}>
                  Found {filteredProducts.length} similar products
                </Text>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                      closeVisualSearchModal();
                      handleVisualSearch();
                    }}
                  >
                    <Icon name="redo" size={16} color="#10b981" />
                    <Text style={styles.retryButtonText}>Try Another</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.viewResultsButton}
                    onPress={closeVisualSearchModal}
                  >
                    <Text style={styles.viewResultsButtonText}>View Results</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!visualSearchImage && (
              <View style={styles.uploadOptions}>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => {
                    closeVisualSearchModal();
                    handleVisualSearch();
                  }}
                >
                  <Icon name="image" size={32} color="#10b981" />
                  <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => {
                    closeVisualSearchModal();
                    handleTakePhoto();
                  }}
                >
                  <Icon name="camera" size={32} color="#10b981" />
                  <Text style={styles.uploadButtonText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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

  // Desktop Layout with Sidebar
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },

  compactCategoryText: {
    fontSize: 10,
    color: '#059669',
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
    color: '#059669',
  },

  compactUnit: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 2,
  },

  compactMeta: {
    marginBottom: 12,
  },

  compactFarmerText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },

  compactStockText: {
    fontSize: 11,
    color: '#9ca3af',
  },

  // Visual Search Styles
  visualSearchFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      },
    }),
  },

  modalContent: {
    width: width > 768 ? 500 : width - 40,
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        position: 'relative' as any,
        zIndex: 10000,
      },
      default: {
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  searchImageContainer: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#f1f5f9',
  },

  searchImage: {
    width: '100%',
    height: '100%',
  },

  searchingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },

  resultsContainer: {
    marginBottom: 20,
  },

  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },

  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },

  labelBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },

  labelText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },

  categoryBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },

  categoryBadgeText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },

  resultsInfo: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginVertical: 16,
  },

  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },

  retryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },

  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },

  viewResultsButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewResultsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  uploadOptions: {
    gap: 16,
    paddingVertical: 20,
  },

  uploadButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },

  // Load More Indicator
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },

  loadMoreText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
});