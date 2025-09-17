import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  LinearGradient,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import NavBar from '../../components/NavBar';
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

  const renderStatCard = (title: string, value: string | number, color: string, gradient: string[], icon: string) => (
    <View style={styles.statCard}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statGradient}
      >
        <View style={styles.statIconContainer}>
          <Text style={styles.statIcon}>{icon}</Text>
        </View>
        <View style={styles.statContent}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </LinearGradient>
    </View>
  );

  const renderWelcomeHeader = () => (
    <View style={styles.welcomeContainer}>
      <LinearGradient
        colors={['#059669', '#10b981', '#34d399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.welcomeGradient}
      >
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeGreeting}>Good day, Farmer!</Text>
          <Text style={styles.welcomeName}>{profile?.full_name || 'Welcome back'}</Text>
          <Text style={styles.welcomeSubtitle}>
            {products.length > 0 
              ? `Managing ${products.length} product${products.length !== 1 ? 's' : ''}`
              : 'Ready to showcase your harvest?'
            }
          </Text>
        </View>
        <View style={styles.welcomeDecoration}>
          <Text style={styles.welcomeEmoji}>🌾</Text>
        </View>
      </LinearGradient>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <LinearGradient
          colors={['#f0fdf4', '#dcfce7']}
          style={styles.emptyIconContainer}
        >
          <Text style={styles.emptyIcon}>🌱</Text>
        </LinearGradient>
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
        <LinearGradient
          colors={['#059669', '#10b981']}
          style={styles.ctaGradient}
        >
          <Text style={styles.ctaIcon}>+</Text>
          <Text style={styles.ctaText}>List Your First Product</Text>
        </LinearGradient>
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
              <Text style={styles.benefitIcon}>{benefit.icon}</Text>
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
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Price</Text>
          <Text style={styles.priceValue}>{formatPrice(product.price)}</Text>
          <Text style={styles.priceUnit}>per {product.unit}</Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.stockContainer}>
          <Text style={styles.stockLabel}>In Stock</Text>
          <Text style={styles.stockValue}>{product.quantity_available}</Text>
          <Text style={styles.stockUnit}>{product.unit}</Text>
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
        <TouchableOpacity style={styles.editButton}>
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
            {renderStatCard('Total Products', stats.total, '#6366f1', ['#6366f1', '#8b5cf6'], '📊')}
            {renderStatCard('Live Products', stats.approved, '#10b981', ['#10b981', '#34d399'], '✅')}
            {renderStatCard('Under Review', stats.pending, '#f59e0b', ['#f59e0b', '#fbbf24'], '⏳')}
            {renderStatCard('Total Value', formatPrice(stats.totalValue), '#06b6d4', ['#06b6d4', '#22d3ee'], '💰')}
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
              <LinearGradient
                colors={['#059669', '#10b981']}
                style={styles.actionGradient}
              >
                <Text style={styles.actionIcon}>+</Text>
                <Text style={styles.primaryActionTitle}>Add Product</Text>
                <Text style={styles.primaryActionSubtitle}>List new produce</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionCard}
              onPress={() => router.push('/farmer/orders')}
              activeOpacity={0.8}
            >
              <View style={styles.secondaryActionContent}>
                <Text style={styles.secondaryActionIcon}>📋</Text>
                <Text style={styles.secondaryActionTitle}>View Orders</Text>
                <Text style={styles.secondaryActionSubtitle}>Manage sales</Text>
              </View>
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
    margin: 20,
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  welcomeGradient: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeContent: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginBottom: 4,
  },
  welcomeName: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
  },
  welcomeDecoration: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeEmoji: {
    fontSize: 28,
  },

  // Section Titles
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },

  // Stats Section
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (width - 56) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  statContent: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Actions Section
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryActionCard: {
    flex: 2,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  actionGradient: {
    padding: 20,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 28,
    color: '#ffffff',
    marginBottom: 8,
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
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  secondaryActionContent: {
    padding: 20,
    alignItems: 'center',
  },
  secondaryActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  secondaryActionTitle: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: 'bold',
    marginBottom: 2,
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
    marginBottom: 20,
  },
  viewAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
  },
  viewAllText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIllustration: {
    marginBottom: 24,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 50,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 40,
    elevation: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 18,
  },
  ctaIcon: {
    fontSize: 20,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
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
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  benefitIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  benefitTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  benefitDesc: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },

  // Products List
  productsList: {
    gap: 16,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
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
    marginRight: 12,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  productMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  priceContainer: {
    flex: 1,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 2,
  },
  priceUnit: {
    fontSize: 12,
    color: '#64748b',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  stockContainer: {
    flex: 1,
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  stockValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  stockUnit: {
    fontSize: 12,
    color: '#64748b',
  },
  productDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 16,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  productDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
  },
  editButtonText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
});