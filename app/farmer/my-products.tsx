import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile, logoutUser } from '../../services/auth';

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

interface Profile {
  first_name: string;
  last_name: string;
  farm_name: string;
  farm_location: string;
}

export default function EnhancedFarmerDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);

  useEffect(() => {
    loadData();
    
    // Animate components on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        setProfile(userData.profile);

        const { data: productsData, error } = await supabase
          .from('products')
          .select('*')
          .eq('farmer_id', userData.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProducts(productsData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
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

  const stats = getStats();

  const renderStatCard = (title: string, value: string | number, color: string, icon: string, subtitle?: string) => (
    <Animated.View 
      style={[
        styles.statCard,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
          <Text style={[styles.statIconText, { color }]}>{icon}</Text>
        </View>
        <View style={[styles.statTrend, { backgroundColor: `${color}10` }]}>
          <Text style={[styles.statTrendText, { color }]}>↗</Text>
        </View>
      </View>
      <Text style={[styles.statNumber, { color }]}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </Animated.View>
  );

  const renderEmptyState = () => (
    <Animated.View 
      style={[
        styles.emptyState,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>🌱</Text>
      </View>
      <Text style={styles.emptyTitle}>Start Growing Your Business</Text>
      <Text style={styles.emptyDescription}>
        Add your first product to begin connecting with buyers in your area. 
        It only takes a few minutes to get started!
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/farmer/products/add')}
      >
        <Text style={styles.emptyButtonIcon}>+</Text>
        <Text style={styles.emptyButtonText}>Add Your First Product</Text>
      </TouchableOpacity>
      
      <View style={styles.emptyFeatures}>
        <View style={styles.emptyFeature}>
          <Text style={styles.emptyFeatureIcon}>✨</Text>
          <Text style={styles.emptyFeatureText}>Quick approval process</Text>
        </View>
        <View style={styles.emptyFeature}>
          <Text style={styles.emptyFeatureIcon}>💰</Text>
          <Text style={styles.emptyFeatureText}>Competitive pricing</Text>
        </View>
        <View style={styles.emptyFeature}>
          <Text style={styles.emptyFeatureIcon}>📱</Text>
          <Text style={styles.emptyFeatureText}>Easy management</Text>
        </View>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingSpinner}>
            <View style={styles.spinner} />
          </View>
          <Text style={styles.loadingText}>Loading your farm...</Text>
          <Text style={styles.loadingSubtext}>Preparing your dashboard</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      
      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.headerBackground}>
          <View style={styles.headerPattern} />
        </View>
        
        <View style={styles.headerContent}>
          {/* Brand Section */}
          <Animated.View 
            style={[
              styles.brandSection,
              { 
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.brandLogo}>
              <Text style={styles.brandIcon}>🌱</Text>
            </View>
            <View style={styles.brandInfo}>
              <Text style={styles.brandName}>Farm2Go</Text>
              <Text style={styles.brandSubtitle}>Farmer Dashboard</Text>
            </View>
          </Animated.View>

          {/* User Info */}
          <Animated.View 
            style={[
              styles.userSection,
              { 
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.userInfo}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.farmerName}>
                {profile?.first_name} {profile?.last_name}
              </Text>
              <View style={styles.farmInfo}>
                <Text style={styles.farmIcon}>🏡</Text>
                <Text style={styles.farmName}>{profile?.farm_name}</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </Animated.View>
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
        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          {renderStatCard('Total Products', stats.total, '#64748b', '📊', 'All listings')}
          {renderStatCard('Approved', stats.approved, '#10b981', '✅', 'Live on market')}
          {renderStatCard('Pending', stats.pending, '#f59e0b', '⏳', 'Under review')}
          {renderStatCard('Total Value', formatPrice(stats.totalValue), '#06b6d4', '💰', 'Portfolio worth')}
        </View>

        {/* Action Buttons */}
        <Animated.View 
          style={[
            styles.actionsContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push('/farmer/products/add')}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>+</Text>
            </View>
            <Text style={styles.primaryActionText}>Add New Product</Text>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.push('/farmer/orders')}
          >
            <View style={styles.secondaryActionIcon}>
              <Text style={styles.secondaryActionIconText}>📋</Text>
            </View>
            <Text style={styles.secondaryActionText}>View Orders</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Products Section */}
        <Animated.View 
          style={[
            styles.productsSection,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Products ({products.length})</Text>
            {products.length > 0 && (
              <TouchableOpacity style={styles.sectionAction}>
                <Text style={styles.sectionActionText}>Manage All</Text>
              </TouchableOpacity>
            )}
          </View>

          {products.length === 0 ? renderEmptyState() : (
            <View style={styles.productsList}>
              {products.slice(0, 3).map((product, index) => (
                <TouchableOpacity
                  key={product.id}
                  style={[
                    styles.productCard,
                    { 
                      transform: [{ 
                        translateY: new Animated.Value(20 * index).interpolate({
                          inputRange: [0, 20],
                          outputRange: [20, 0]
                        })
                      }]
                    }
                  ]}
                  onPress={() => router.push(`/farmer/products/${product.id}`)}
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
                </TouchableOpacity>
              ))}
              
              {products.length > 3 && (
                <TouchableOpacity 
                  style={styles.viewAllButton}
                  onPress={() => router.push('/farmer/products')}
                >
                  <Text style={styles.viewAllText}>
                    View all {products.length} products →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>

        {/* Quick Tips */}
        <Animated.View 
          style={[
            styles.tipsSection,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={styles.tipsTitle}>💡 Pro Tips</Text>
          <View style={styles.tipsList}>
            <View style={styles.tip}>
              <Text style={styles.tipIcon}>📸</Text>
              <Text style={styles.tipText}>Add high-quality photos to increase buyer interest</Text>
            </View>
            <View style={styles.tip}>
              <Text style={styles.tipIcon}>💰</Text>
              <Text style={styles.tipText}>Check market prices regularly for competitive pricing</Text>
            </View>
            <View style={styles.tip}>
              <Text style={styles.tipIcon}>⚡</Text>
              <Text style={styles.tipText}>Respond to buyer inquiries within 2 hours for better rankings</Text>
            </View>
          </View>
        </Animated.View>

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
  
  // Loading States
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingSpinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  spinner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#e5e7eb',
    borderTopColor: '#10b981',
  },
  loadingText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 16,
    color: '#64748b',
  },

  // Header Styles
  header: {
    backgroundColor: '#1e293b',
    paddingBottom: 40,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
    backgroundColor: 'transparent',
  },
  headerContent: {
    paddingTop: 60,
    paddingHorizontal: 24,
    position: 'relative',
    zIndex: 2,
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    justifyContent: 'center',
  },
  brandLogo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  brandIcon: {
    fontSize: 24,
  },
  brandInfo: {
    alignItems: 'center',
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  userSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 8,
    fontWeight: '500',
  },
  farmerName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
    letterSpacing: -1,
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
    color: '#10b981',
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 250, 252, 0.2)',
  },
  logoutIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },

  // Content Styles
  content: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 32,
  },

  // Stats Grid
  statsContainer: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    marginTop: -20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconText: {
    fontSize: 18,
  },
  statTrend: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTrendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 32,
  },
  primaryAction: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionIconText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '700',
  },
  primaryActionText: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
  },
  actionArrow: {
    fontSize: 18,
    color: '#ffffff',
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  secondaryActionIcon: {
    marginRight: 8,
  },
  secondaryActionIconText: {
    fontSize: 16,
  },
  secondaryActionText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },

  // Products Section
  productsSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  sectionAction: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionActionText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    backgroundColor: '#fafafa',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
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
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 32,
  },
  emptyButtonIcon: {
    fontSize: 18,
    color: '#ffffff',
    marginRight: 8,
    fontWeight: '700',
  },
  emptyButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyFeatures: {
    alignItems: 'center',
    gap: 12,
  },
  emptyFeature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyFeatureIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  emptyFeatureText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },

  // Products List
  productsList: {
    gap: 16,
  },
  productCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  productCategory: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: -0.3,
  },
  priceUnit: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 6,
    fontWeight: '500',
  },
  productQuantity: {
    alignItems: 'flex-end',
  },
  quantityAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  quantityUnit: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  viewAllButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },

  // Tips Section
  tipsSection: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: '#f8fafc',
    marginHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  tipsList: {
    gap: 16,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tipIcon: {
    fontSize: 20,
    marginRight: 16,
    width: 32,
    textAlign: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 40,
  },
});