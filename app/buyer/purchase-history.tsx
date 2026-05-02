// ─── services/orders.ts addition ─────────────────────────────────────────────
// Add this function to your existing services/orders.ts

/*
export const submitProductRating = async (
  orderId: string,
  rating: number,        // 1–5
  comment: string
): Promise<void> => {
  const { error } = await supabase
    .from('orders')
    .update({ ratings: rating })
    .eq('id', orderId);

  if (error) throw error;
};
*/

// ─── Updated purchase-history screen ─────────────────────────────────────────

import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FilterSidebar from "../../components/FilterSidebar";
import HeaderComponent from "../../components/HeaderComponent";
import { getUserWithProfile } from "../../services/auth";
import { getBuyerOrders, submitProductRating } from "../../services/orders";
import { Database } from "../../types/database";
import {
  ORDER_STATUS_CONFIG,
  OrderWithDetails,
  TRANSACTION_STATUS_CONFIG,
} from "../../types/orders";
import { applyFilters } from "../../utils/filterConfigs";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// ratings column is an integer (0 = not yet rated, 1–5 = star rating)
// We store the comment locally since the DB only has the numeric rating
interface RatingState {
  [orderId: string]: {
    rating: number; // mirrors orders.ratings
    comment: string; // local only (no DB column for comment)
    submitted: boolean;
  };
}

const TIME_PERIODS = [
  { key: "all", label: "All Time" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "year", label: "This Year" },
];

const AMOUNT_RANGES = [
  { key: "all", label: "All Amounts", min: 0, max: 10000 },
  { key: "low", label: "₱0 - ₱500", min: 0, max: 500 },
  { key: "medium", label: "₱500 - ₱1,500", min: 500, max: 1500 },
  { key: "high", label: "₱1,500 - ₱3,000", min: 1500, max: 3000 },
  { key: "premium", label: "₱3,000+", min: 3000, max: 10000 },
];

const SORT_OPTIONS = [
  { key: "newest", label: "Newest First" },
  { key: "oldest", label: "Oldest First" },
  { key: "amount-high", label: "Amount: High to Low" },
  { key: "amount-low", label: "Amount: Low to High" },
  { key: "status", label: "Status" },
];

const { width } = Dimensions.get("window");
const isDesktop = width >= 1024;

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "vegetables", label: "Vegetables" },
  { key: "fruits", label: "Fruits" },
  { key: "grains", label: "Grains" },
  { key: "herbs", label: "Herbs" },
];

const RATING_LABELS = ["", "Terrible", "Bad", "Okay", "Good", "Excellent"];

// ─── Rating Modal ─────────────────────────────────────────────────────────────

interface RatingModalProps {
  visible: boolean;
  order: OrderWithDetails | null;
  onClose: () => void;
  onSubmit: (orderId: string, rating: number, comment: string) => Promise<void>;
  existingRating?: { rating: number; comment: string; submitted: boolean };
}

function RatingModal({
  visible,
  order,
  onClose,
  onSubmit,
  existingRating,
}: RatingModalProps) {
  const [selectedRating, setSelectedRating] = useState(
    existingRating?.rating || 0,
  );
  const [comment, setComment] = useState(existingRating?.comment || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedRating(existingRating?.rating || 0);
      setComment(existingRating?.comment || "");
    }
  }, [visible, existingRating]);

  if (!order) return null;

  const isUpdate = existingRating?.submitted;

  const handleSubmit = async () => {
    if (selectedRating === 0) {
      Alert.alert("Select Rating", "Please tap a star before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(order.id, selectedRating, comment);
      onClose();
    } catch {
      Alert.alert("Error", "Failed to submit rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setComment((prev) => {
      const tags = prev
        ? prev
            .split(", ")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      const idx = tags.indexOf(tag);
      if (idx >= 0) {
        tags.splice(idx, 1);
      } else {
        tags.push(tag);
      }
      return tags.join(", ");
    });
  };

  const isTagSelected = (tag: string) =>
    comment
      .split(", ")
      .map((t) => t.trim())
      .includes(tag);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          {/* Handle bar */}
          <View style={ms.handle} />

          {/* Header */}
          <View style={ms.header}>
            <Text style={ms.headerTitle}>
              {isUpdate ? "Update Review" : "Rate Product"}
            </Text>
            <TouchableOpacity style={ms.closeBtn} onPress={onClose}>
              <Text style={ms.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={ms.scrollContent}
          >
            {/* Product row */}
            <View style={ms.productRow}>
              <View style={ms.productThumb}>
                <Text style={ms.productEmoji}>🥬</Text>
              </View>
              <View style={ms.productMeta}>
                <Text style={ms.productName} numberOfLines={2}>
                  {order.product?.name || "Unknown Product"}
                </Text>
                <Text style={ms.farmName}>
                  {order.farmer_profile?.farm_name ||
                    `${order.farmer_profile?.first_name || ""} ${order.farmer_profile?.last_name || ""}`.trim() ||
                    "Unknown Farm"}
                </Text>
                <Text style={ms.orderCode}>
                  {order.purchase_code || order.id.slice(0, 8).toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Stars */}
            <View style={ms.starsSection}>
              <Text style={ms.starsPrompt}>
                How would you rate this product?
              </Text>
              <View style={ms.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setSelectedRating(star)}
                    activeOpacity={0.7}
                    style={ms.starBtn}
                  >
                    <Text
                      style={[ms.star, star <= selectedRating && ms.starFilled]}
                    >
                      {star <= selectedRating ? "★" : "☆"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {selectedRating > 0 && (
                <Text style={ms.ratingLabel}>
                  {RATING_LABELS[selectedRating]}
                </Text>
              )}
            </View>

            {/* Quick tags */}
            <View style={ms.tagsSection}>
              <Text style={ms.sectionLabel}>QUICK TAGS</Text>
              <View style={ms.tagsWrap}>
                {[
                  "Fresh",
                  "Good Quality",
                  "True to Description",
                  "Fast Delivery",
                  "Good Packaging",
                ].map((tag) => {
                  const sel = isTagSelected(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[ms.tag, sel && ms.tagSel]}
                      onPress={() => toggleTag(tag)}
                      activeOpacity={0.7}
                    >
                      {sel && <Text style={ms.tagCheck}>✓ </Text>}
                      <Text style={[ms.tagText, sel && ms.tagTextSel]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Comment */}
            <View style={ms.commentSection}>
              <Text style={ms.sectionLabel}>WRITE A REVIEW (OPTIONAL)</Text>
              <TextInput
                style={ms.textarea}
                placeholder="Share your experience with this product..."
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={ms.charCount}>{comment.length}/500</Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={ms.footer}>
            <TouchableOpacity
              style={ms.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                ms.submitBtn,
                (selectedRating === 0 || submitting) && ms.submitDisabled,
              ]}
              onPress={handleSubmit}
              disabled={selectedRating === 0 || submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={ms.submitText}>
                  {isUpdate ? "Update Review" : "Submit Review"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BuyerPurchaseHistoryScreen() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showSidebar, setShowSidebar] = useState(false);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingTargetOrder, setRatingTargetOrder] =
    useState<OrderWithDetails | null>(null);
  const [ratings, setRatings] = useState<RatingState>({});

  const [filterState, setFilterState] = useState({
    category: "all",
    amountRange: "all",
    dateRange: "all",
    sortBy: "newest",
  });
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadData();
  }, []);
  useEffect(() => {
    filterOrdersByPeriod();
  }, [orders, selectedStatus, filterState]);

  const loadData = async () => {
    try {
      const userData = await getUserWithProfile();
      if (!userData?.profile) {
        Alert.alert(
          "Profile Not Found",
          "Unable to load your profile. Please try refreshing.",
          [
            { text: "Retry", onPress: loadData },
            { text: "OK", style: "cancel" },
          ],
        );
        return;
      }
      setProfile(userData.profile);
      await loadOrders(userData.user.id);
    } catch (error) {
      console.error("Error loading data:", error);
      Alert.alert(
        "Error",
        "Failed to load purchase history. Please try again.",
        [
          { text: "Retry", onPress: loadData },
          { text: "OK", style: "cancel" },
        ],
      );
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (buyerId: string) => {
    const ordersData = await getBuyerOrders(buyerId);
    setOrders(ordersData);

    // Hydrate ratings from orders.ratings (integer column, 0 = unrated)
    const initial: RatingState = {};
    ordersData.forEach((order) => {
      const r = order.ratings as number;
      if (r && r > 0) {
        initial[order.id] = { rating: r, comment: "", submitted: true };
      }
    });
    setRatings(initial);
  };

  const filterOrdersByPeriod = () => {
    let filtered = orders;
    if (selectedStatus !== "all") {
      filtered = filtered.filter((o) => o.status === selectedStatus);
    }
    filtered = applyFilters(filtered, filterState, {
      categoryKey: "product.category",
      priceKey: "total_price",
      dateKey: "created_at",
    });
    setFilteredOrders(filtered);
  };

  const handleFilterChange = (key: string, value: any) =>
    setFilterState((prev) => ({ ...prev, [key]: value }));

  const onRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      const userData = await getUserWithProfile();
      if (userData?.user) await loadOrders(userData.user.id);
    } catch (e) {
      console.error("Refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const openRatingModal = (order: OrderWithDetails) => {
    setRatingTargetOrder(order);
    setRatingModalVisible(true);
  };

  // Calls submitProductRating which does: UPDATE orders SET ratings = $rating WHERE id = $orderId
  const handleRatingSubmit = async (
    orderId: string,
    rating: number,
    comment: string,
  ) => {
    await submitProductRating(orderId, rating, comment);
    setRatings((prev) => ({
      ...prev,
      [orderId]: { rating, comment, submitted: true },
    }));
    // Also update the local orders array so renderStars reflects immediately
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, ratings: rating } : o)),
    );
  };

  const renderMiniStars = (rating: number) =>
    [1, 2, 3, 4, 5].map((i) => (
      <Text
        key={i}
        style={[styles.miniStar, i <= rating && styles.miniStarActive]}
      >
        ★
      </Text>
    ));

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatPrice = (p: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(p);

  const getStatusDisplay = (status: string) => {
    const config =
      ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    return config
      ? { text: config.label.toUpperCase(), color: config.color }
      : { text: status.toUpperCase(), color: "#6b7280" };
  };

  const getPaymentStatusDisplay = (status?: string) => {
    if (!status) return { text: "NO PAYMENT", color: "#6b7280" };
    const config =
      TRANSACTION_STATUS_CONFIG[
        status as keyof typeof TRANSACTION_STATUS_CONFIG
      ];
    return config
      ? { text: config.label.toUpperCase(), color: config.color }
      : { text: status.toUpperCase(), color: "#6b7280" };
  };

  // ── Order Card ─────────────────────────────────────────────────────────────

  const renderOrderCard = ({ item: order }: { item: OrderWithDetails }) => {
    const isDelivered = order.status === "delivered";
    const orderRating = ratings[order.id];
    const hasRated = !!orderRating?.submitted;

    return (
      <View style={styles.orderCard}>
        {/* Shop header */}
        <View style={styles.shopHeader}>
          <View style={styles.shopInfo}>
            <View style={styles.shopIconContainer}>
              <Text style={styles.shopIcon}>🌾</Text>
            </View>
            <View>
              <Text style={styles.shopName}>
                {order.farmer_profile?.farm_name ||
                  `${order.farmer_profile?.first_name || ""} ${order.farmer_profile?.last_name || ""}`.trim() ||
                  "Unknown Farm"}
              </Text>
              <Text style={styles.shopLocation}>
                {order.farmer_profile?.barangay || "Local Farm"}
              </Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusDisplay(order.status).color },
              ]}
            >
              <Text style={styles.statusText}>
                {getStatusDisplay(order.status).text}
              </Text>
            </View>
            {order.transaction && (
              <View
                style={[
                  styles.paymentBadge,
                  {
                    backgroundColor: getPaymentStatusDisplay(
                      order.transaction.status,
                    ).color,
                  },
                ]}
              >
                <Text style={styles.statusText}>
                  {getPaymentStatusDisplay(order.transaction.status).text}
                </Text>
              </View>
            )}
            <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          </View>
        </View>

        {/* Product */}
        <View style={styles.productsSection}>
          <View style={styles.productItem}>
            <View style={styles.productImageContainer}>
              <Text style={styles.productImage}>🥬</Text>
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={2}>
                {order.product?.name || "Unknown Product"}
              </Text>
              <Text style={styles.productVariation}>
                Category: {order.product?.category || "N/A"}
              </Text>
              <Text style={styles.productQuantity}>
                Quantity: {order.quantity} {order.product?.unit || "pcs"}
              </Text>
              <Text style={styles.productNote}>
                Order ID: {order.purchase_code || order.id.slice(0, 8)}
              </Text>

              {/* Rating display */}
              {hasRated && (
                <View style={styles.ratingDisplay}>
                  <View style={styles.miniStarsRow}>
                    {renderMiniStars(orderRating.rating)}
                  </View>
                  <Text style={styles.ratingScoreText}>
                    {orderRating.rating}/5
                  </Text>
                  {orderRating.comment ? (
                    <Text style={styles.ratingComment} numberOfLines={1}>
                      · "{orderRating.comment}"
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
            <View style={styles.productPriceContainer}>
              <Text style={styles.productPrice}>
                {formatPrice(order.product?.price || 0)}
              </Text>
              <Text style={styles.productTotal}>
                Total: {formatPrice(order.total_price)}
              </Text>
            </View>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.orderSummary}>
          <View style={styles.summaryRow}>
            <Text style={styles.itemCount}>1 item • Order Total:</Text>
            <Text style={styles.totalPrice}>
              {formatPrice(order.total_price)}
            </Text>
          </View>
          {order.delivery_address && (
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliveryLabel}>Delivery to:</Text>
              <Text style={styles.deliveryAddress} numberOfLines={2}>
                {order.delivery_address}
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              const farmerId = order.farmer_profile?.id;
              if (farmerId) {
                router.push(`/buyer/contact-farmer/${farmerId}` as any);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Contact Seller</Text>
          </TouchableOpacity>

          {isDelivered && (
            <TouchableOpacity
              style={[styles.rateButton, hasRated && styles.rateButtonDone]}
              onPress={() => openRatingModal(order)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.rateButtonIcon,
                  hasRated && styles.rateButtonIconDone,
                ]}
              >
                {hasRated ? "★" : "☆"}
              </Text>
              <Text
                style={[
                  styles.rateButtonText,
                  hasRated && styles.rateButtonTextDone,
                ]}
              >
                {hasRated ? `Rated ${orderRating.rating}/5` : "Rate Product"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.primaryActionButton}>
            <Text style={styles.primaryButtonText}>Buy Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getFilterSections = () => [
    {
      key: "category",
      title: "Categories",
      type: "category" as const,
      options: CATEGORY_FILTERS.map((c) => ({
        key: c.key,
        label: c.label,
        count:
          c.key === "all"
            ? orders.length
            : orders.filter((o) => o.product?.category?.toLowerCase() === c.key)
                .length,
      })),
    },
    {
      key: "amountRange",
      title: "Amount Range",
      type: "range" as const,
      options: AMOUNT_RANGES.map((r) => ({
        key: r.key,
        label: r.label,
        min: r.min,
        max: r.max,
      })),
    },
    {
      key: "dateRange",
      title: "Date Range",
      type: "range" as const,
      options: TIME_PERIODS.map((p) => ({ key: p.key, label: p.label })),
    },
    {
      key: "sortBy",
      title: "Sort By",
      type: "sort" as const,
      options: SORT_OPTIONS.map((s) => ({ key: s.key, label: s.label })),
    },
  ];

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
      </View>
      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptyDescription}>
        {selectedStatus === "all"
          ? "You haven't made any orders yet. Start shopping to support local farmers!"
          : "No orders found for the selected filters."}
      </Text>
      {selectedStatus === "all" &&
        filterState.category === "all" &&
        filterState.amountRange === "all" && (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push("/")}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaIcon}>🛍️</Text>
            <Text style={styles.ctaText}>Start Shopping</Text>
          </TouchableOpacity>
        )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderComponent
          profile={profile}
          userType="buyer"
          currentRoute="/buyer/purchase-history"
          showMessages
          showNotifications
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading purchase history...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderComponent
        profile={profile}
        userType="buyer"
        currentRoute="/buyer/purchase-history"
        showMessages
        showNotifications
        showFilterButton={!isDesktop}
        onFilterPress={() => setShowSidebar(!showSidebar)}
      />

      <View style={styles.tabBar}>
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.tab, selectedStatus === s.key && styles.activeTab]}
            onPress={() => setSelectedStatus(s.key)}
          >
            <Text
              style={[
                styles.tabText,
                selectedStatus === s.key && styles.activeTabText,
              ]}
            >
              {s.label}
            </Text>
            {selectedStatus === s.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.mainContent}>
        {isDesktop && (
          <FilterSidebar
            sections={getFilterSections()}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            width={240}
          />
        )}
        <View
          style={[
            styles.ordersContainer,
            isDesktop && styles.ordersContainerWithSidebar,
          ]}
        >
          <ScrollView
            style={styles.scrollView}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#ee4d2d"
                colors={["#ee4d2d"]}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {filteredOrders.length === 0 ? (
              renderEmptyState()
            ) : (
              <View style={styles.ordersList}>
                {filteredOrders.map((order) => (
                  <View key={order.id}>{renderOrderCard({ item: order })}</View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {!isDesktop && (
        <FilterSidebar
          sections={getFilterSections()}
          filterState={filterState}
          onFilterChange={handleFilterChange}
          showMobile={showSidebar}
          onCloseMobile={() => setShowSidebar(false)}
          title="Filters"
        />
      )}

      <RatingModal
        visible={ratingModalVisible}
        order={ratingTargetOrder}
        onClose={() => setRatingModalVisible(false)}
        onSubmit={handleRatingSubmit}
        existingRating={
          ratingTargetOrder ? ratings[ratingTargetOrder.id] : undefined
        }
      />
    </View>
  );
}

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    paddingBottom: 24,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e0e0e0",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    fontSize: 13,
    color: "#555",
    fontWeight: "700",
  },
  scrollContent: {
    paddingBottom: 8,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  productThumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#d1fae5",
  },
  productEmoji: { fontSize: 26 },
  productMeta: { flex: 1 },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 3,
  },
  farmName: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "500",
    marginBottom: 2,
  },
  orderCode: {
    fontSize: 11,
    color: "#aaa",
    fontFamily: "monospace",
  },
  starsSection: {
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  starsPrompt: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 18,
  },
  starsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  starBtn: { padding: 4 },
  star: {
    fontSize: 46,
    color: "#e0e0e0",
  },
  starFilled: {
    color: "#f59e0b",
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f59e0b",
    letterSpacing: 0.3,
  },
  tagsSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  tagSel: {
    backgroundColor: "#f0fdf4",
    borderColor: "#10b981",
  },
  tagCheck: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: "700",
  },
  tagText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "500",
  },
  tagTextSel: {
    color: "#10b981",
    fontWeight: "600",
  },
  commentSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  textarea: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#333",
    minHeight: 88,
    backgroundColor: "#fafafa",
  },
  charCount: {
    fontSize: 11,
    color: "#ccc",
    textAlign: "right",
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#ee4d2d",
    alignItems: "center",
  },
  submitDisabled: {
    backgroundColor: "#f9a89a",
  },
  submitText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
  },
});

// ─── Main Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    position: "relative",
  },
  activeTab: { borderBottomWidth: 2, borderBottomColor: "#ee4d2d" },
  tabText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
  },
  activeTabText: { color: "#ee4d2d", fontWeight: "600" },
  tabIndicator: {
    position: "absolute",
    bottom: -1,
    height: 2,
    width: "100%",
    backgroundColor: "#ee4d2d",
  },
  scrollView: { flex: 1, backgroundColor: "#f5f5f5" },
  ordersList: { padding: 12, gap: 8 },
  orderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  shopHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  shopInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  shopIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  shopIcon: { fontSize: 12, color: "#ffffff" },
  shopName: { fontSize: 15, fontWeight: "600", color: "#333" },
  shopLocation: { fontSize: 12, color: "#999" },
  statusContainer: { alignItems: "flex-end" },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 4,
  },
  paymentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 10,
    color: "#ffffff",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  orderDate: { fontSize: 11, color: "#999" },
  productsSection: { paddingHorizontal: 16, paddingVertical: 12 },
  productItem: { flexDirection: "row", alignItems: "flex-start" },
  productImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 4,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  productImage: { fontSize: 24 },
  productDetails: { flex: 1 },
  productName: {
    fontSize: 14,
    color: "#333",
    fontWeight: "400",
    lineHeight: 18,
    marginBottom: 4,
  },
  productVariation: { fontSize: 12, color: "#999", marginBottom: 2 },
  productQuantity: { fontSize: 12, color: "#666", marginBottom: 2 },
  productNote: { fontSize: 11, color: "#999", fontStyle: "italic" },
  productTotal: { fontSize: 12, color: "#666", marginTop: 2 },
  productPriceContainer: { alignItems: "flex-end" },
  productPrice: { fontSize: 14, color: "#ee4d2d", fontWeight: "600" },
  ratingDisplay: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 3,
  },
  miniStarsRow: { flexDirection: "row" },
  miniStar: { fontSize: 13, color: "#e0e0e0" },
  miniStarActive: { color: "#f59e0b" },
  ratingScoreText: { fontSize: 11, color: "#f59e0b", fontWeight: "600" },
  ratingComment: {
    fontSize: 11,
    color: "#888",
    fontStyle: "italic",
    flexShrink: 1,
  },
  orderSummary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemCount: { fontSize: 12, color: "#666", flex: 1 },
  totalPrice: { fontSize: 16, color: "#ee4d2d", fontWeight: "bold" },
  deliveryInfo: { marginTop: 8 },
  deliveryLabel: { fontSize: 12, color: "#666", fontWeight: "500" },
  deliveryAddress: {
    fontSize: 12,
    color: "#333",
    marginTop: 2,
    lineHeight: 16,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "#fafafa",
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#dee2e6",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  secondaryButtonText: { fontSize: 12, color: "#666", fontWeight: "500" },
  rateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    gap: 4,
  },
  rateButtonDone: { borderColor: "#10b981", backgroundColor: "#f0fdf4" },
  rateButtonIcon: { fontSize: 13, color: "#f59e0b" },
  rateButtonIconDone: { color: "#10b981" },
  rateButtonText: { fontSize: 11, color: "#f59e0b", fontWeight: "600" },
  rateButtonTextDone: { color: "#10b981" },
  primaryActionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: "#ee4d2d",
    alignItems: "center",
  },
  primaryButtonText: { fontSize: 12, color: "#ffffff", fontWeight: "600" },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e9ecef",
    marginBottom: 24,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ee4d2d",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
  },
  ctaIcon: { fontSize: 16, marginRight: 8 },
  ctaText: { fontSize: 14, color: "#ffffff", fontWeight: "600" },
  mainContent: { flex: 1, flexDirection: "row" },
  ordersContainer: { flex: 1 },
  ordersContainerWithSidebar: { flex: 1 },
});
