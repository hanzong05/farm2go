import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, Dimensions, Platform, StatusBar, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../../lib/supabase';
import { getUserWithProfile } from '../../services/auth';
import ContactWidget, { ContactPerson } from '../../components/ContactWidget';

const { width } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity_available: number;
  unit: string;
  category: string;
  farmer_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  image_url?: string;
  farmer_profile?: {
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
  };
}

interface Profile {
  id: string;
  user_type: 'buyer' | 'farmer' | 'admin';
  first_name: string | null;
  last_name: string | null;
  farm_name?: string | null;
}

const colors = {
  primary: '#059669',
  secondary: '#10b981',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  white: '#ffffff',
  background: '#f9fafb',
  surface: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  shadow: 'rgba(0,0,0,0.1)',
  lightGray: '#f3f4f6',
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);

  // Contact widget state
  const [showContactWidget, setShowContactWidget] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load profile and product in parallel
      const [userData, productResult] = await Promise.all([
        getUserWithProfile(),
        supabase
          .from('products')
          .select(`
            *,
            farmer_profile:farmer_id (
              first_name,
              last_name,
              farm_name
            )
          `)
          .eq('id', id)
          .single()
      ]);

      // Set profile
      if (userData?.profile) {
        setProfile(userData.profile);
      } else {
        setProfile({
          id: '00000000-0000-0000-0000-000000000000',
          user_type: 'buyer',
          first_name: null,
          last_name: null,
        } as any);
      }

      // Set product
      if (productResult.error) {
        setError('Product not found');
      } else {
        setProduct(productResult.data);
      }
    } catch (err) {
      console.error('Load error:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (!product || !profile) return;
    const editRoute = profile.user_type === 'admin'
      ? `/admin/products/edit/${id}`
      : `/farmer/products/edit/${id}`;
    router.push(editRoute as any);
  };

  const handleDelete = async () => {
    if (!product || !profile) return;

    Alert.alert(
      'Delete Product?',
      `Are you sure you want to delete "${product.name}"?${isAdmin && !isOwner ? '\n\nNote: You are deleting this as an admin.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);

              // Admins can delete any product, farmers can only delete their own
              const deleteQuery = supabase
                .from('products')
                .delete()
                .eq('id', id);

              // Only add farmer_id filter if user is not admin
              if (!isAdmin) {
                deleteQuery.eq('farmer_id', profile.id);
              }

              const { error } = await deleteQuery;

              if (error) throw error;

              Alert.alert('Success', 'Product deleted', [
                {
                  text: 'OK',
                  onPress: () => {
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      // Navigate to appropriate home screen
                      if (isAdmin) {
                        router.replace('/admin/products' as any);
                      } else if (isFarmer) {
                        router.replace('/farmer/my-products' as any);
                      } else {
                        router.replace('/' as any);
                      }
                    }
                  }
                }
              ]);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete product');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handleApproveReject = async (action: 'approved' | 'rejected') => {
    if (!product) return;

    const actionText = action === 'approved' ? 'approve' : 'reject';
    Alert.alert(
      `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Product`,
      `Are you sure you want to ${actionText} "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          onPress: async () => {
            try {
              setProcessing(true);
              const { error } = await supabase
                .from('products')
                .update({ status: action })
                .eq('id', id);

              if (error) throw error;

              Alert.alert('Success', `Product ${action}`, [
                { text: 'OK', onPress: () => loadData() }
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to update product');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handleOrder = () => {
    if (!product || !profile) return;

    if (profile.id === '00000000-0000-0000-0000-000000000000') {
      Alert.alert('Login Required', 'Please log in to place an order.');
      return;
    }

    if (orderQuantity > product.quantity_available) {
      Alert.alert('Invalid Quantity', 'Order quantity cannot exceed available stock');
      return;
    }

    router.push(`/order/${product.id}?quantity=${orderQuantity}` as any);
  };


  const handleContactOpen = () => {
    if (!product || !profile) return;

    if (profile.id === '00000000-0000-0000-0000-000000000000') {
      Alert.alert('Login Required', 'Please log in to contact the seller.');
      return;
    }

    setShowContactWidget(true);
  };

  const handleContactClose = () => {
    setShowContactWidget(false);
  };

  // Utility Functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return colors.success;
      case 'pending': return colors.warning;
      case 'rejected': return colors.danger;
      default: return colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Live';
      case 'pending': return 'Under Review';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getFarmerName = () => {
    if (!product?.farmer_profile) return 'Unknown Farmer';
    return `${product.farmer_profile.first_name} ${product.farmer_profile.last_name}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading product...</Text>
        </View>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <View style={styles.errorContent}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error || 'Product not found'}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/' as any);
              }
            }}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Helper functions - safe to use after data is loaded
  const isLoggedIn = profile && profile.id !== '00000000-0000-0000-0000-000000000000';
  const isOwner = profile && product && profile.id === product.farmer_id;
  const isAdmin = profile?.user_type === 'admin';
  const isFarmer = profile?.user_type === 'farmer';
  const isBuyer = profile?.user_type === 'buyer';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              // Navigate to appropriate home screen based on user type
              if (isAdmin) {
                router.replace('/admin/products' as any);
              } else if (isFarmer) {
                router.replace('/farmer/my-products' as any);
              } else {
                router.replace('/' as any);
              }
            }
          }}
          activeOpacity={0.7}
        >
          <Icon name="arrow-left" size={20} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isAdmin ? 'Product Management' : isFarmer ? 'My Product Details' : 'Product Details'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrapper}>
          {/* Left Column - Product Image */}
          <View style={styles.leftColumn}>
            <View style={styles.imageContainer}>
              {product.image_url ? (
                <Image
                  source={{ uri: product.image_url }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.noImageContainer}>
                  <Icon name="image" size={48} color={colors.textSecondary} />
                  <Text style={styles.noImageText}>No Image Available</Text>
                </View>
              )}
            </View>
          </View>

          {/* Right Column - Product Information */}
          <View style={styles.rightColumn}>
            {/* Product Code */}
            <Text style={styles.productCode}>PRODUCT CODE : {product.id.slice(-8).toUpperCase()}</Text>

            {/* Product Name */}
            <Text style={styles.productName}>{product.name.toUpperCase()}</Text>

            {/* Farmer Info (for buyers and admins) */}
            {(isBuyer || isAdmin) && (
              <Text style={styles.farmerName}>by {getFarmerName()}</Text>
            )}

            {/* Price */}
            <View style={styles.priceContainer}>
              <Text style={styles.price}>{formatPrice(product.price)}</Text>
              <Text style={styles.priceUnit}>/ {product.unit}</Text>
            </View>

            {/* Rating/Reviews placeholder */}
            <View style={styles.ratingContainer}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Icon key={star} name="star" size={14} color={colors.warning} solid />
                ))}
              </View>
              <Text style={styles.reviewText}>5 reviews</Text>
            </View>

            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(product.status) }]}>
              <Text style={styles.statusText}>{getStatusText(product.status)}</Text>
            </View>

            {/* Product Description */}
            {product.description && (
              <Text style={styles.description}>{product.description}</Text>
            )}

            {/* Product Details */}
            <View style={styles.detailsSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>CATEGORY:</Text>
                <Text style={styles.detailValue}>{product.category.toUpperCase()}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>AVAILABLE:</Text>
                <Text style={styles.detailValue}>{product.quantity_available} {product.unit}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>CREATED:</Text>
                <Text style={styles.detailValue}>
                  {new Date(product.created_at).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
              </View>
            </View>

            {/* Farmer Management Section - Only for product owners */}
            {isFarmer && isOwner && (
              <View style={styles.managementSection}>
                <Text style={styles.sectionTitle}>PRODUCT MANAGEMENT</Text>
                <View style={styles.managementButtons}>
                  <TouchableOpacity style={styles.editButton} onPress={handleEdit} disabled={processing}>
                    <Icon name="edit" size={16} color={colors.primary} />
                    <Text style={styles.editButtonText}>Edit Product</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={processing}>
                    {processing ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Icon name="trash" size={16} color={colors.danger} />
                    )}
                    <Text style={styles.deleteButtonText}>Delete Product</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Admin Management Section - Admins can manage any product */}
            {isAdmin && (
              <View style={styles.managementSection}>
                <Text style={styles.sectionTitle}>ADMIN ACTIONS</Text>

                {/* Edit and Delete buttons */}
                <View style={styles.managementButtons}>
                  <TouchableOpacity style={styles.editButton} onPress={handleEdit} disabled={processing}>
                    <Icon name="edit" size={16} color={colors.primary} />
                    <Text style={styles.editButtonText}>Edit Product</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={processing}>
                    {processing ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Icon name="trash" size={16} color={colors.danger} />
                    )}
                    <Text style={styles.deleteButtonText}>Delete Product</Text>
                  </TouchableOpacity>
                </View>

                {/* Approval buttons for pending products */}
                {product.status === 'pending' && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>PRODUCT APPROVAL</Text>
                    <View style={styles.managementButtons}>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleApproveReject('rejected')}
                        disabled={processing}
                      >
                        {processing ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Icon name="times" size={16} color={colors.white} />
                        )}
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => handleApproveReject('approved')}
                        disabled={processing}
                      >
                        {processing ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Icon name="check" size={16} color={colors.white} />
                        )}
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Login Prompt for Non-Logged-In Users */}
            {isBuyer && product.status === 'approved' && !isLoggedIn && (
              <View style={styles.orderSection}>
                <Text style={styles.sectionTitle}>INTERESTED IN THIS PRODUCT?</Text>
                <Text style={styles.loginPromptText}>Please log in to place an order</Text>
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={() => router.push('/auth/login' as any)}
                >
                  <Icon name="sign-in-alt" size={16} color={colors.white} />
                  <Text style={styles.loginButtonText}>Log In</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Buyer Order Section - buyers can only order products, not edit them */}
            {isBuyer && product.status === 'approved' && isLoggedIn && (
              <View style={styles.orderSection}>
                <Text style={styles.sectionTitle}>PLACE ORDER</Text>
                <View style={styles.quantityContainer}>
                  <Text style={styles.quantityLabel}>Quantity:</Text>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                    >
                      <Icon name="minus" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantityInput}
                      value={orderQuantity.toString()}
                      onChangeText={(text) => {
                        const num = parseInt(text) || 1;
                        setOrderQuantity(Math.max(1, Math.min(product.quantity_available, num)));
                      }}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => setOrderQuantity(Math.min(product.quantity_available, orderQuantity + 1))}
                    >
                      <Icon name="plus" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.totalPrice}>Total: {formatPrice(product.price * orderQuantity)}</Text>

                {/* Action Buttons */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.contactSellerButton}
                    onPress={handleContactOpen}
                    disabled={processing}
                  >
                    <Icon name="comment" size={16} color={colors.primary} />
                    <Text style={styles.contactSellerButtonText}>Contact Seller</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.orderButton}
                    onPress={handleOrder}
                    disabled={processing || orderQuantity > product.quantity_available}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Icon name="shopping-cart" size={16} color={colors.white} />
                    )}
                    <Text style={styles.orderButtonText}>Place Order</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Contact Widget - floating at bottom right for browser, full screen for mobile */}
      {product && isBuyer && !isOwner && (
        <ContactWidget
          contactPerson={{
            id: product.farmer_id,
            name: getFarmerName(),
            type: 'farmer',
            isOnline: true
          }}
          currentUserId={profile?.id}
          currentUserName={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Buyer'}
          currentUserType={profile?.user_type || 'buyer'}
          visible={showContactWidget}
          onOpen={handleContactOpen}
          onClose={handleContactClose}
          relatedProductId={product.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44,
    paddingBottom: 16,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
    marginHorizontal: 16,
  },

  headerRight: {
    width: 40,
  },

  scrollView: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  loadingContent: {
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 32,
  },

  errorContent: {
    alignItems: 'center',
  },

  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },

  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },

  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },

  contentWrapper: {
    flexDirection: width > 768 ? 'row' : 'column',
    backgroundColor: colors.surface,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  leftColumn: {
    flex: width > 768 ? 1 : undefined,
    backgroundColor: colors.lightGray,
  },

  imageContainer: {
    height: width > 768 ? 400 : 300,
    justifyContent: 'center',
    alignItems: 'center',
  },

  productImage: {
    width: '100%',
    height: '100%',
  },

  noImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  noImageText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  rightColumn: {
    flex: width > 768 ? 1 : undefined,
    padding: 24,
  },

  productCode: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 1,
  },

  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 32,
  },

  farmerName: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
    fontStyle: 'italic',
  },

  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },

  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },

  priceUnit: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 4,
  },

  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },

  reviewText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
    textTransform: 'uppercase',
  },

  description: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 24,
  },

  detailsSection: {
    marginBottom: 24,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  detailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    letterSpacing: 1,
  },

  managementSection: {
    marginBottom: 24,
  },

  managementButtons: {
    flexDirection: 'row',
    gap: 12,
  },

  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lightGray,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  },

  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lightGray,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: 8,
  },

  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },

  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },

  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },

  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  orderSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },

  quantityContainer: {
    marginBottom: 16,
  },

  quantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },

  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quantityInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  totalPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },

  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  contactSellerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },

  contactSellerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },

  orderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },

  orderButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },

  loginPromptText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },

  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },

  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});