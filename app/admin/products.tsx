import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import HeaderComponent from '../../components/HeaderComponent';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

const { width } = Dimensions.get('window');

type Product = Database['public']['Tables']['products']['Row'] & {
  farmer_profile?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
  };
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);

      // Verify admin access
      const userData = await getUserWithProfile();
      if (!userData?.profile || !['admin', 'super-admin'].includes(userData.profile.user_type)) {
        Alert.alert('Access Denied', 'You do not have permission to access this page.');
        router.back();
        return;
      }

      // Load products with farmer info
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          farmer_profile:profiles!products_farmer_id_fkey(
            first_name,
            last_name,
            farm_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleProductAction = async (productId: string, action: 'approved' | 'rejected') => {
    const product = products.find(p => p.id === productId);
    const farmerName = product?.farmer_profile ?
      `${product.farmer_profile.first_name} ${product.farmer_profile.last_name}` :
      'Unknown Farmer';

    Alert.alert(
      `${action === 'approved' ? 'Approve' : 'Reject'} Product?`,
      `Are you sure you want to ${action === 'approved' ? 'approve' : 'reject'} "${product?.name}" by ${farmerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Yes, ${action === 'approved' ? 'Approve' : 'Reject'}`,
          style: action === 'approved' ? 'default' : 'destructive',
          onPress: () => updateProductStatus(productId, action)
        }
      ]
    );
  };

  const updateProductStatus = async (productId: string, status: 'approved' | 'rejected') => {
    try {
      setProcessing(productId);

      const { error } = await supabase
        .from('products')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) throw error;

      Alert.alert(
        'Success!',
        `Product ${status} successfully`,
        [{ text: 'OK', onPress: () => loadProducts() }]
      );
    } catch (error) {
      console.error('Error updating product:', error);
      Alert.alert('Error', 'Failed to update product status');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'pending': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Pending Review';
      default: return status;
    }
  };

  const renderProduct = (product: Product) => {
    const farmerName = product.farmer_profile ?
      `${product.farmer_profile.first_name} ${product.farmer_profile.last_name}` :
      'Unknown Farmer';

    const farmName = product.farmer_profile?.farm_name;
    const isProcessing = processing === product.id;

    return (
      <View key={product.id} style={styles.productCard}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Text style={styles.noImageText}>No Image</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(product.status) }]}>
              <Text style={styles.statusText}>{getStatusText(product.status)}</Text>
            </View>
          </View>

          <Text style={styles.farmerName}>by {farmerName}</Text>
          {farmName && <Text style={styles.farmName}>{farmName}</Text>}

          <Text style={styles.productDescription} numberOfLines={2}>
            {product.description || 'No description provided'}
          </Text>

          <View style={styles.productDetails}>
            <Text style={styles.price}>₱{product.price.toFixed(2)}/{product.unit}</Text>
            <Text style={styles.category}>{product.category}</Text>
            <Text style={styles.quantity}>{product.quantity_available} available</Text>
          </View>

          {/* Action Buttons - Only show for pending products */}
          {product.status === 'pending' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleProductAction(product.id, 'rejected')}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Reject</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleProductAction(product.id, 'approved')}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderComponent showBackButton title="Product Management" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent showBackButton title="Product Management" />

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        ) : (
          <View style={styles.productsList}>
            {products.map(renderProduct)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
  productsList: {
    paddingVertical: 16,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 200,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  productInfo: {
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  farmerName: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 4,
  },
  farmName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
  category: {
    fontSize: 14,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quantity: {
    fontSize: 14,
    color: '#374151',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});