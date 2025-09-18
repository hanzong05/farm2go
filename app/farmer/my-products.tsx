import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import NavBar from '../../components/NavBar';
import StatCard from '../../components/StatCard';
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


  const renderWelcomeHeader = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeContent}>
        <View style={styles.welcomeText}>
          <Text style={styles.welcomeGreeting}>Good day, Farmer!</Text>
          <Text style={styles.welcomeName}>
            {profile?.first_name 
              ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}`
              : 'Welcome back'
            }
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {products.length > 0 
              ? `Managing ${products.length} product${products.length !== 1 ? 's' : ''}`
              : 'Ready to showcase your harvest?'
            }
          </Text>
        </View>
        <View style={styles.welcomeIconContainer}>
          <Text style={styles.welcomeIcon}>🌾</Text>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>🌱</Text>
        </View>
      </View>
      
      <Text style={styles.emptyTitle}>Start Your Digital Farm</Text>
      <Text style={styles.emptyDescription}>
        Transform your farming business by connecting directly with customers. 
        List your first product and start earning better profits today.
      </Text>

      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => {
          console.log('🚀 Navigating to add product page');
          router.push('/farmer/products/add');
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaIcon}>+</Text>
        <Text style={styles.ctaText}>List Your First Product</Text>
      </TouchableOpacity>

      <View style={styles.benefitsGrid}>
        <Text style={styles.benefitsTitle}>Why choose Farm2Go?</Text>
        <View style={styles.benefitsContainer}>
          {[
            { icon: '🎯', title: 'Direct Sales', desc: 'Sell directly to customers' },
            { icon: '💰', title: 'Better Profits', desc: 'Keep more of your earnings' },
            { icon: '📱', title: 'Easy Management', desc: 'Simple order tracking' },
            { icon: '🚀', title: 'Grow Business', desc: 'Expand your reach' },
          ].map((benefit, index) => (
            <View key={index} style={styles.benefitCard}>
              <View style={styles.benefitIconContainer}>
                <Text style={styles.benefitIcon}>{benefit.icon}</Text>
              </View>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitDesc}>{benefit.desc}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderProductCard = (product: Product) => (
    <TouchableOpacity
      key={product.id}
      style={styles.productCard}
      onPress={() => router.push(`/farmer/products/${product.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.productHeader}>
        <View style={styles.productMainInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productCategory}>{product.category}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          {
            backgroundColor: 
              product.status === 'approved' ? '#059669' :
              product.status === 'pending' ? '#d97706' : '#dc2626'
          }
        ]}>
          <Text style={styles.statusText}>
            {product.status === 'approved' ? 'LIVE' :
             product.status === 'pending' ? 'REVIEW' : 'REJECTED'}
          </Text>
        </View>
      </View>

      <View style={styles.productMetrics}>
        <View style={styles.priceSection}>
          <Text style={styles.metricLabel}>Price</Text>
          <Text style={styles.priceValue}>{formatPrice(product.price)}</Text>
          <Text style={styles.metricUnit}>per {product.unit}</Text>
        </View>
        
        <View style={styles.metricsVerticalDivider} />
        
        <View style={styles.stockSection}>
          <Text style={styles.metricLabel}>In Stock</Text>
          <Text style={styles.stockValue}>{product.quantity_available}</Text>
          <Text style={styles.metricUnit}>{product.unit}</Text>
        </View>
      </View>

      {product.description && (
        <Text style={styles.productDescription} numberOfLines={2}>
          {product.description}
        </Text>
      )}

      <View style={styles.productFooter}>
        <Text style={styles.productDate}>
          Listed {new Date(product.created_at).toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric'
          })}
        </Text>
        <TouchableOpacity style={styles.editButton} activeOpacity={0.7}>
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading your farm dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavBar currentRoute="/farmer/my-products" />

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
        {renderWelcomeHeader()}

        {/* Enhanced Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Dashboard Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard title="Total Products" value={stats.total} color="#6366f1" backgroundColor="#f0f0ff" icon="📊" />
            <StatCard title="Live Products" value={stats.approved} color="#10b981" backgroundColor="#ecfdf5" icon="✅" />
            <StatCard title="Under Review" value={stats.pending} color="#f59e0b" backgroundColor="#fffbeb" icon="⏳" />
            <StatCard title="Total Value" value={formatPrice(stats.totalValue)} color="#06b6d4" backgroundColor="#ecfeff" icon="💰" />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.primaryActionCard}
              onPress={() => router.push('/farmer/products/add')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryActionIcon}>+</Text>
              <Text style={styles.primaryActionTitle}>Add Product</Text>
              <Text style={styles.primaryActionSubtitle}>List new produce</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionCard}
              onPress={() => router.push('/farmer/orders')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryActionIcon}>📋</Text>
              <Text style={styles.secondaryActionTitle}>View Orders</Text>
              <Text style={styles.secondaryActionSubtitle}>Manage sales</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Products Section */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              My Products {products.length > 0 && `(${products.length})`}
            </Text>
            {products.length > 0 && (
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => router.push('/farmer/inventory')}
                activeOpacity={0.7}
              >
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
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

  // Welcome Header
  welcomeContainer: {
    backgroundColor: '#10b981',
    margin: 20,
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 28,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginBottom: 6,
  },
  welcomeName: {
    fontSize: 26,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
    lineHeight: 20,
  },
  welcomeIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 20,
  },
  welcomeIcon: {
    fontSize: 32,
  },

  // Section Titles
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 20,
  },

  // Stats Section
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  // Actions Section
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  primaryActionCard: {
    flex: 2,
    backgroundColor: '#10b981',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  primaryActionIcon: {
    fontSize: 32,
    color: '#ffffff',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  primaryActionTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  primaryActionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  secondaryActionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryActionIcon: {
    fontSize: 28,
    marginBottom: 12,
  },
  secondaryActionTitle: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  secondaryActionSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },

  // Products Section
  productsSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  viewAllButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#ecfdf5',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  viewAllText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 36,
    paddingVertical: 20,
    borderRadius: 16,
    marginBottom: 48,
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  ctaIcon: {
    fontSize: 22,
    color: '#ffffff',
    marginRight: 12,
    fontWeight: 'bold',
  },
  ctaText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  benefitsGrid: {
    width: '100%',
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 24,
    textAlign: 'center',
  },
  benefitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  benefitCard: {
    width: (width - 80) / 2,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  benefitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  benefitIcon: {
    fontSize: 24,
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  benefitDesc: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Products List
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
    marginBottom: 20,
  },
  productMainInfo: {
    flex: 1,
    marginRight: 16,
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 26,
  },
  productCategory: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  productMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  priceSection: {
    flex: 1,
    alignItems: 'center',
  },
  stockSection: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
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
  metricUnit: {
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
  productDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 20,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 20,
  },
  productDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  editButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  editButtonText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
});