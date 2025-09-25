import { FilterSection } from '../components/FilterSidebar';

// Common filter configurations for different pages

// Marketplace filters
export const getMarketplaceFilters = (products: any[]): FilterSection[] => [
  {
    key: 'category',
    title: 'Categories',
    type: 'category',
    options: [
      { key: 'all', label: 'All', count: products.length },
      { key: 'vegetables', label: 'Vegetables', count: products.filter(p => p.category?.toLowerCase() === 'vegetables').length },
      { key: 'fruits', label: 'Fruits', count: products.filter(p => p.category?.toLowerCase() === 'fruits').length },
      { key: 'grains', label: 'Grains', count: products.filter(p => p.category?.toLowerCase() === 'grains').length },
      { key: 'herbs', label: 'Herbs', count: products.filter(p => p.category?.toLowerCase() === 'herbs').length },
    ],
  },
  {
    key: 'priceRange',
    title: 'Price Range',
    type: 'range',
    options: [
      { key: 'all', label: 'All Prices', min: 0, max: 10000 },
      { key: 'low', label: '₱0 - ₱50', min: 0, max: 50 },
      { key: 'medium', label: '₱50 - ₱100', min: 50, max: 100 },
      { key: 'high', label: '₱100 - ₱500', min: 100, max: 500 },
      { key: 'premium', label: '₱500+', min: 500, max: 10000 },
    ],
  },
  {
    key: 'availability',
    title: 'Availability',
    type: 'toggle',
    options: [
      { key: 'inStock', label: 'In Stock Only' },
    ],
  },
  {
    key: 'sortBy',
    title: 'Sort By',
    type: 'sort',
    options: [
      { key: 'newest', label: 'Newest First' },
      { key: 'price-low', label: 'Price: Low to High' },
      { key: 'price-high', label: 'Price: High to Low' },
      { key: 'name', label: 'Name A-Z' },
      { key: 'popular', label: 'Most Popular' },
    ],
  },
];

// Purchase History filters
export const getPurchaseHistoryFilters = (orders: any[]): FilterSection[] => [
  {
    key: 'category',
    title: 'Categories',
    type: 'category',
    options: [
      { key: 'all', label: 'All', count: orders.length },
      { key: 'vegetables', label: 'Vegetables', count: orders.filter(o => o.product?.category?.toLowerCase() === 'vegetables').length },
      { key: 'fruits', label: 'Fruits', count: orders.filter(o => o.product?.category?.toLowerCase() === 'fruits').length },
      { key: 'grains', label: 'Grains', count: orders.filter(o => o.product?.category?.toLowerCase() === 'grains').length },
      { key: 'herbs', label: 'Herbs', count: orders.filter(o => o.product?.category?.toLowerCase() === 'herbs').length },
    ],
  },
  {
    key: 'amountRange',
    title: 'Amount Range',
    type: 'range',
    options: [
      { key: 'all', label: 'All Amounts', min: 0, max: 10000 },
      { key: 'low', label: '₱0 - ₱500', min: 0, max: 500 },
      { key: 'medium', label: '₱500 - ₱1,500', min: 500, max: 1500 },
      { key: 'high', label: '₱1,500 - ₱3,000', min: 1500, max: 3000 },
      { key: 'premium', label: '₱3,000+', min: 3000, max: 10000 },
    ],
  },
  {
    key: 'dateRange',
    title: 'Date Range',
    type: 'range',
    options: [
      { key: 'all', label: 'All Time' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
      { key: 'quarter', label: 'This Quarter' },
      { key: 'year', label: 'This Year' },
    ],
  },
  {
    key: 'sortBy',
    title: 'Sort By',
    type: 'sort',
    options: [
      { key: 'newest', label: 'Newest First' },
      { key: 'oldest', label: 'Oldest First' },
      { key: 'amount-high', label: 'Amount: High to Low' },
      { key: 'amount-low', label: 'Amount: Low to High' },
      { key: 'status', label: 'Status' },
    ],
  },
];

// Farmer Orders filters
export const getFarmerOrdersFilters = (orders: any[]): FilterSection[] => [
  {
    key: 'status',
    title: 'Order Status',
    type: 'category',
    options: [
      { key: 'all', label: 'All Orders', count: orders.length },
      { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
      { key: 'confirmed', label: 'Confirmed', count: orders.filter(o => o.status === 'confirmed').length },
      { key: 'shipped', label: 'Shipped', count: orders.filter(o => o.status === 'shipped').length },
      { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
      { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length },
    ],
  },
  {
    key: 'paymentStatus',
    title: 'Payment Status',
    type: 'category',
    options: [
      { key: 'all', label: 'All Payments', count: orders.length },
      { key: 'pending', label: 'Payment Pending', count: orders.filter(o => o.transaction?.status === 'pending').length },
      { key: 'completed', label: 'Paid', count: orders.filter(o => o.transaction?.status === 'completed').length },
      { key: 'failed', label: 'Payment Failed', count: orders.filter(o => o.transaction?.status === 'failed').length },
    ],
  },
  {
    key: 'amountRange',
    title: 'Order Value',
    type: 'range',
    options: [
      { key: 'all', label: 'All Amounts', min: 0, max: 10000 },
      { key: 'small', label: '₱0 - ₱500', min: 0, max: 500 },
      { key: 'medium', label: '₱500 - ₱1,500', min: 500, max: 1500 },
      { key: 'large', label: '₱1,500 - ₱3,000', min: 1500, max: 3000 },
      { key: 'bulk', label: '₱3,000+', min: 3000, max: 10000 },
    ],
  },
  {
    key: 'dateRange',
    title: 'Date Range',
    type: 'range',
    options: [
      { key: 'all', label: 'All Time' },
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
      { key: 'quarter', label: 'This Quarter' },
    ],
  },
  {
    key: 'urgentOnly',
    title: 'Priority Orders',
    type: 'toggle',
    options: [
      { key: 'urgent', label: 'Urgent Orders Only' },
    ],
  },
  {
    key: 'sortBy',
    title: 'Sort By',
    type: 'sort',
    options: [
      { key: 'newest', label: 'Newest First' },
      { key: 'oldest', label: 'Oldest First' },
      { key: 'amount-high', label: 'Highest Value' },
      { key: 'amount-low', label: 'Lowest Value' },
      { key: 'status', label: 'By Status' },
      { key: 'urgent', label: 'Urgent First' },
    ],
  },
];

// Farmer Sales History filters
export const getFarmerSalesFilters = (sales: any[]): FilterSection[] => [
  {
    key: 'category',
    title: 'Product Categories',
    type: 'category',
    options: [
      { key: 'all', label: 'All Products', count: sales.length },
      { key: 'vegetables', label: 'Vegetables', count: sales.filter(s => s.product?.category?.toLowerCase() === 'vegetables').length },
      { key: 'fruits', label: 'Fruits', count: sales.filter(s => s.product?.category?.toLowerCase() === 'fruits').length },
      { key: 'grains', label: 'Grains', count: sales.filter(s => s.product?.category?.toLowerCase() === 'grains').length },
      { key: 'herbs', label: 'Herbs', count: sales.filter(s => s.product?.category?.toLowerCase() === 'herbs').length },
    ],
  },
  {
    key: 'revenueRange',
    title: 'Revenue Range',
    type: 'range',
    options: [
      { key: 'all', label: 'All Revenue', min: 0, max: 50000 },
      { key: 'small', label: '₱0 - ₱1,000', min: 0, max: 1000 },
      { key: 'medium', label: '₱1,000 - ₱5,000', min: 1000, max: 5000 },
      { key: 'large', label: '₱5,000 - ₱15,000', min: 5000, max: 15000 },
      { key: 'enterprise', label: '₱15,000+', min: 15000, max: 50000 },
    ],
  },
  {
    key: 'period',
    title: 'Time Period',
    type: 'range',
    options: [
      { key: 'all', label: 'All Time' },
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
      { key: 'quarter', label: 'This Quarter' },
      { key: 'year', label: 'This Year' },
    ],
  },
  {
    key: 'performance',
    title: 'Performance',
    type: 'toggle',
    options: [
      { key: 'topSelling', label: 'Top Selling Products' },
      { key: 'repeatCustomers', label: 'Repeat Customers Only' },
    ],
  },
  {
    key: 'sortBy',
    title: 'Sort By',
    type: 'sort',
    options: [
      { key: 'revenue-high', label: 'Highest Revenue' },
      { key: 'revenue-low', label: 'Lowest Revenue' },
      { key: 'quantity-high', label: 'Most Sold' },
      { key: 'quantity-low', label: 'Least Sold' },
      { key: 'newest', label: 'Recent Sales' },
      { key: 'customer', label: 'By Customer' },
    ],
  },
];

// Admin/Super Admin filters
export const getAdminUsersFilters = (users: any[]): FilterSection[] => [
  {
    key: 'userType',
    title: 'User Type',
    type: 'category',
    options: [
      { key: 'all', label: 'All Users', count: users.length },
      { key: 'farmer', label: 'Farmers', count: users.filter(u => u.user_type === 'farmer').length },
      { key: 'buyer', label: 'Buyers', count: users.filter(u => u.user_type === 'buyer').length },
      { key: 'admin', label: 'Admins', count: users.filter(u => u.user_type === 'admin').length },
    ],
  },
  {
    key: 'verificationStatus',
    title: 'Verification',
    type: 'category',
    options: [
      { key: 'all', label: 'All Status', count: users.length },
      { key: 'verified', label: 'Verified', count: users.filter(u => u.verified).length },
      { key: 'pending', label: 'Pending', count: users.filter(u => !u.verified && u.verification_submitted).length },
      { key: 'unverified', label: 'Unverified', count: users.filter(u => !u.verified && !u.verification_submitted).length },
    ],
  },
  {
    key: 'location',
    title: 'Location',
    type: 'category',
    options: [
      { key: 'all', label: 'All Locations', count: users.length },
      // Dynamic barangay options would be populated here
    ],
  },
  {
    key: 'activity',
    title: 'Activity',
    type: 'toggle',
    options: [
      { key: 'activeOnly', label: 'Active Users Only' },
      { key: 'recentActivity', label: 'Recent Activity (30 days)' },
    ],
  },
  {
    key: 'sortBy',
    title: 'Sort By',
    type: 'sort',
    options: [
      { key: 'newest', label: 'Newest First' },
      { key: 'oldest', label: 'Oldest First' },
      { key: 'name', label: 'Name A-Z' },
      { key: 'location', label: 'By Location' },
      { key: 'activity', label: 'Last Active' },
    ],
  },
];

// Helper function to apply filters
export const applyFilters = (
  data: any[],
  filterState: any,
  filterConfig: {
    categoryKey?: string;
    priceKey?: string;
    dateKey?: string;
    searchKeys?: string[];
    customFilters?: { [key: string]: (item: any, value: any) => boolean };
  }
) => {
  let filtered = [...data];

  // Apply each filter
  Object.keys(filterState).forEach(key => {
    const value = filterState[key];
    if (!value || value === 'all') return;

    switch (key) {
      case 'category':
        if (filterConfig.categoryKey && value !== 'all') {
          filtered = filtered.filter(item =>
            item[filterConfig.categoryKey!]?.toLowerCase() === value.toLowerCase()
          );
        }
        break;

      case 'priceRange':
      case 'amountRange':
      case 'revenueRange':
        if (filterConfig.priceKey) {
          // Find the range configuration
          const ranges = {
            'low': { min: 0, max: 500 },
            'medium': { min: 500, max: 1500 },
            'high': { min: 1500, max: 3000 },
            'premium': { min: 3000, max: 10000 },
            // Add more as needed
          };
          const range = ranges[value as keyof typeof ranges];
          if (range) {
            filtered = filtered.filter(item => {
              const price = item[filterConfig.priceKey!];
              return price >= range.min && price <= range.max;
            });
          }
        }
        break;

      case 'dateRange':
      case 'period':
        if (filterConfig.dateKey) {
          const now = new Date();
          let startDate: Date;

          switch (value) {
            case 'today':
              startDate = new Date(now.setHours(0, 0, 0, 0));
              break;
            case 'week':
              startDate = new Date(now.setDate(now.getDate() - 7));
              break;
            case 'month':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
            case 'quarter':
              const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
              startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
              break;
            case 'year':
              startDate = new Date(now.getFullYear(), 0, 1);
              break;
            default:
              startDate = new Date(0);
          }

          if (value !== 'all') {
            filtered = filtered.filter(item =>
              new Date(item[filterConfig.dateKey!]) >= startDate
            );
          }
        }
        break;

      default:
        // Handle custom filters
        if (filterConfig.customFilters && filterConfig.customFilters[key]) {
          filtered = filtered.filter(item => filterConfig.customFilters![key](item, value));
        }
        break;
    }
  });

  // Apply sorting
  if (filterState.sortBy) {
    const sortBy = filterState.sortBy;
    switch (sortBy) {
      case 'newest':
        filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        filtered = filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'name':
        filtered = filtered.sort((a, b) => a.name?.localeCompare(b.name) || 0);
        break;
      case 'price-low':
      case 'amount-low':
      case 'revenue-low':
        filtered = filtered.sort((a, b) => (a.price || a.total_price || a.amount || 0) - (b.price || b.total_price || b.amount || 0));
        break;
      case 'price-high':
      case 'amount-high':
      case 'revenue-high':
        filtered = filtered.sort((a, b) => (b.price || b.total_price || b.amount || 0) - (a.price || a.total_price || a.amount || 0));
        break;
    }
  }

  return filtered;
};