import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile, logoutUser } from '../../services/auth';
import { Database } from '../../types/database';

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
}

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function MyProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('🔍 Loading farmer data...');
      const userData = await getUserWithProfile();
      console.log('👤 User data:', userData);

      if (userData?.profile) {
        setProfile(userData.profile);
        console.log('✅ Profile set:', userData.profile.user_type);
        console.log('🆔 User ID for query:', userData.user.id);

        const { data: productsData, error } = await supabase
          .from('products')
          .select('*')
          .eq('farmer_id', userData.user.id)
          .order('created_at', { ascending: false });

        console.log('📦 Products query result:', { productsData, error });
        console.log('📊 Products count:', productsData?.length || 0);

        if (error) {
          console.error('❌ Products query error:', error);
          throw error;
        }

        setProducts(productsData || []);
        console.log('✅ Products state updated');
      } else {
        console.log('❌ No user data or profile found');
      }
    } catch (error) {
      console.error('❌ Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
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

  const getStats = () => {
    const approvedProducts = products.filter(p => p.status === 'approved').length;
    const pendingProducts = products.filter(p => p.status === 'pending').length;
    const rejectedProducts = products.filter(p => p.status === 'rejected').length;
    const totalValue = products
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + (p.price * p.quantity_available), 0);

    return {
      total: products.length,
      approved: approvedProducts,
      pending: pendingProducts,
      rejected: rejectedProducts,
      totalValue,
    };
  };

  const stats = getStats();

  const renderStatCard = (title: string, value: string | number, color: string, icon: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Text style={[styles.statIcon, { color }]}>{icon}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>🌱</Text>
      </View>
      <Text style={styles.emptyTitle}>Welcome to Your Farm Dashboard!</Text>
      <Text style={styles.emptyDescription}>
        Start by adding your first product to connect with buyers and grow your business.
      </Text>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          console.log('🚀 Navigating to add product page');
          router.push('/farmer/products/add');
        }}
      >
        <Text style={styles.addButtonIcon}>+</Text>
        <Text style={styles.addButtonText}>Add Your First Product</Text>
      </TouchableOpacity>

      <View style={styles.benefitsContainer}>
        <Text style={styles.benefitsTitle}>Why sell on Farm2Go?</Text>
        <View style={styles.benefit}>
          <Text style={styles.benefitIcon}>🎯</Text>
          <Text style={styles.benefitText}>Direct access to local buyers</Text>
        </View>
        <View style={styles.benefit}>
          <Text style={styles.benefitIcon}>💰</Text>
          <Text style={styles.benefitText}>Better prices for your produce</Text>
        </View>
        <View style={styles.benefit}>
          <Text style={styles.benefitIcon}>📱</Text>
          <Text style={styles.benefitText}>Easy order management</Text>
        </View>
      </View>
    </View>
  );

  const renderProductCard = (product: Product) => (
    <TouchableOpacity
      key={product.id}
      style={styles.productCard}
      onPress={() => router.push(`/farmer/products/${product.id}` as any)}
    >
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productCategory}>{product.category}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          {
            backgroundColor: product.status === 'approved' ? '#dcfce7' :
                           product.status === 'pending' ? '#fef3c7' : '#fecaca'
          }
        ]}>
          <Text style={[
            styles.statusText,
            {
              color: product.status === 'approved' ? '#16a34a' :
                     product.status === 'pending' ? '#d97706' : '#dc2626'
            }
          ]}>
            {product.status === 'approved' ? '✓ Live' :
             product.status === 'pending' ? '⏳ Review' : '✕ Rejected'}
          </Text>
        </View>
      </View>

      <View style={styles.productDetails}>
        <View style={styles.productPrice}>
          <Text style={styles.priceAmount}>{formatPrice(product.price)}</Text>
          <Text style={styles.priceUnit}>per {product.unit}</Text>
        </View>
        <View style={styles.productQuantity}>
          <Text style={styles.quantityAmount}>{product.quantity_available}</Text>
          <Text style={styles.quantityUnit}>{product.unit} available</Text>
        </View>
      </View>

      {product.description && (
        <Text style={styles.productDescription} numberOfLines={2}>
          {product.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading your products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#10b981" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userInfo}>
            <Text style={styles.farmerName}>
              {profile?.first_name} {profile?.last_name}
            </Text>
            {profile?.farm_name && (
              <View style={styles.farmInfo}>
                <Text style={styles.farmIcon}>🏡</Text>
                <Text style={styles.farmName}>{profile.farm_name}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
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
        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            {renderStatCard('Total', stats.total, '#64748b', '📊')}
            {renderStatCard('Live', stats.approved, '#10b981', '✅')}
          </View>
          <View style={styles.statsRow}>
            {renderStatCard('Pending', stats.pending, '#f59e0b', '⏳')}
            {renderStatCard('Value', formatPrice(stats.totalValue), '#06b6d4', '💰')}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push('/farmer/products/add')}
          >
            <Text style={styles.actionIcon}>+</Text>
            <Text style={styles.primaryActionText}>Add New Product</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.push('/farmer/orders')}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.secondaryActionText}>View Orders</Text>
          </TouchableOpacity>
        </View>

        {/* Products Section */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Products ({products.length})</Text>
            {products.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/farmer/inventory')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {products.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.productsList}>
              {products.map(renderProductCard)}
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
    backgroundColor: '#f8fafc',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },

  // Header
  header: {
    backgroundColor: '#10b981',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#d1fae5',
    marginBottom: 4,
  },
  farmerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  farmInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  farmIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  farmName: {
    fontSize: 16,
    color: '#d1fae5',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '600',
  },

  // Content
  content: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginTop: -15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
  },

  // Stats
  statsContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  primaryAction: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 18,
    marginRight: 8,
    color: '#ffffff',
  },
  primaryActionText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryActionText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },

  // Products Section
  productsSection: {
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  viewAllText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIconText: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 32,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonIcon: {
    fontSize: 20,
    color: '#ffffff',
    marginRight: 8,
    fontWeight: 'bold',
  },
  addButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  benefitsContainer: {
    alignItems: 'center',
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#64748b',
  },

  // Products List
  productsList: {
    gap: 16,
  },
  productCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  priceUnit: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 4,
  },
  productQuantity: {
    alignItems: 'flex-end',
  },
  quantityAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  quantityUnit: {
    fontSize: 12,
    color: '#64748b',
  },
  productDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 40,
  },
});