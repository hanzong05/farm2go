import { supabase } from '../lib/supabase';

export interface ProductAnalytics {
  productId: string;
  productName: string;
  totalSold: number;
  totalRevenue: number;
  totalOrders: number;
  averageOrderSize: number;
  unit: string;
  category: string;
  topBuyers: Array<{
    buyerName: string;
    quantityPurchased: number;
    totalSpent: number;
  }>;
}

export interface UserAnalytics {
  userId: string;
  userName: string;
  userType: string;
  totalRevenue?: number;
  totalOrders: number;
  totalSpent?: number;
  topProducts: Array<{
    productName: string;
    quantity: number;
    amount: number;
  }>;
}

export interface AnalyticsData {
  buyer?: {
    totalOrders: number;
    totalSpent: number;
    pendingOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    ordersByStatus: Record<string, number>;
    topProducts: Array<{
      name: string;
      count: number;
      totalSpent: number;
    }>;
    mostBoughtCrop: {
      name: string;
      percentage: number;
      count: number;
      totalSpent: number;
    } | null;
  };
  farmer?: {
    totalProducts: number;
    activeProducts: number;
    totalRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    ordersByStatus: Record<string, number>;
    topProducts: Array<{
      name: string;
      soldQuantity: number;
      unit: string;
      revenue: number;
    }>;
    productsByCategory: Record<string, number>;
    topRevenueCrop: {
      name: string;
      revenue: number;
      quantity: number;
      unit: string;
    } | null;
    topSoldCrop: {
      name: string;
      quantity: number;
      unit: string;
      revenue: number;
    } | null;
  };
  admin?: {
    totalUsers: number;
    farmers: number;
    buyers: number;
    totalOrders: number;
    pendingOrders: number;
    totalProducts: number;
    activeProducts: number;
    totalRevenue: number;
    ordersByStatus: Record<string, number>;
    topFarmers: Array<{
      name: string;
      farmName?: string;
      revenue: number;
    }>;
    topProducts: Array<{
      name: string;
      orderCount: number;
      revenue: number;
    }>;
    topCropThisMonth: {
      name: string;
      quantity: number;
      revenue: number;
      orderCount: number;
    } | null;
    highestCropBought: {
      name: string;
      quantity: number;
      revenue: number;
      sellerName: string;
    } | null;
    highestCropInBarangay: {
      name: string;
      quantity: number;
      revenue: number;
      orderCount: number;
    } | null;
  };
  superAdmin?: {
    totalUsers: number;
    farmers: number;
    buyers: number;
    admins: number;
    totalOrders: number;
    completedOrders: number;
    totalProducts: number;
    activeProducts: number;
    totalRevenue: number;
    verifiedUsers: number;
    pendingVerifications: number;
    ordersByStatus: Record<string, number>;
    barangayStats: Array<{
      name: string;
      farmers: number;
      orders: number;
      revenue: number;
    }>;
    topProducts: Array<{
      name: string;
      category: string;
      orderCount: number;
      revenue: number;
    }>;
    topCropThisMonth: {
      name: string;
      quantity: number;
      revenue: number;
      orderCount: number;
    } | null;
    highestCropBought: {
      name: string;
      quantity: number;
      revenue: number;
      sellerName: string;
    } | null;
  };
}

export async function getAnalyticsData(
  userType: 'buyer' | 'farmer' | 'admin' | 'super-admin',
  userId: string,
  barangay?: string
): Promise<AnalyticsData> {
  console.log(`📊 Loading analytics for ${userType} - ${userId}`);

  switch (userType) {
    case 'buyer':
      return { buyer: await getBuyerAnalytics(userId) };
    case 'farmer':
      return { farmer: await getFarmerAnalytics(userId) };
    case 'admin':
      return { admin: await getAdminAnalytics(barangay!) };
    case 'super-admin':
      return { superAdmin: await getSuperAdminAnalytics() };
    default:
      throw new Error('Invalid user type');
  }
}

async function getBuyerAnalytics(buyerId: string) {
  try {
    // Get all orders for buyer
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_price,
        quantity,
        product:products(name, category)
      `)
      .eq('buyer_id', buyerId);

    if (ordersError) throw ordersError;

    const totalOrders = orders?.length || 0;
    const totalSpent = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;
    const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
    const completedOrders = orders?.filter(o => o.status === 'delivered').length || 0;
    const cancelledOrders = orders?.filter(o => o.status === 'cancelled').length || 0;

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    orders?.forEach(order => {
      const status = order.status || 'unknown';
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });

    // Top products
    const productMap: Record<string, { name: string; count: number; totalSpent: number }> = {};
    orders?.forEach(order => {
      if (order.product) {
        const productName = (order.product as any).name;
        if (!productMap[productName]) {
          productMap[productName] = { name: productName, count: 0, totalSpent: 0 };
        }
        productMap[productName].count++;
        productMap[productName].totalSpent += order.total_price || 0;
      }
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    // Most bought crop with percentage
    const mostBoughtCrop = topProducts.length > 0 ? {
      name: topProducts[0].name,
      percentage: Math.round((topProducts[0].count / totalOrders) * 100),
      count: topProducts[0].count,
      totalSpent: topProducts[0].totalSpent,
    } : null;

    return {
      totalOrders,
      totalSpent,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      ordersByStatus,
      topProducts,
      mostBoughtCrop,
    };
  } catch (error) {
    console.error('Error fetching buyer analytics:', error);
    throw error;
  }
}

async function getFarmerAnalytics(farmerId: string) {
  try {
    // Get all products for farmer
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, category, status, unit')
      .eq('farmer_id', farmerId);

    if (productsError) throw productsError;

    const totalProducts = products?.length || 0;
    const activeProducts = products?.filter(p => p.status === 'approved').length || 0;

    // Get all orders for farmer's products
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_price,
        quantity,
        product_id,
        product:products(name, unit)
      `)
      .eq('farmer_id', farmerId);

    if (ordersError) throw ordersError;

    const totalOrders = orders?.length || 0;
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;
    const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
    const completedOrders = orders?.filter(o => o.status === 'delivered').length || 0;

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    orders?.forEach(order => {
      const status = order.status || 'unknown';
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });

    // Top products by revenue
    const productSales: Record<string, { name: string; soldQuantity: number; unit: string; revenue: number }> = {};
    orders?.forEach(order => {
      if (order.product) {
        const productName = (order.product as any).name;
        const unit = (order.product as any).unit;
        if (!productSales[productName]) {
          productSales[productName] = { name: productName, soldQuantity: 0, unit, revenue: 0 };
        }
        productSales[productName].soldQuantity += order.quantity || 0;
        productSales[productName].revenue += order.total_price || 0;
      }
    });
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top revenue crop
    const topRevenueCrop = topProducts.length > 0 ? {
      name: topProducts[0].name,
      revenue: topProducts[0].revenue,
      quantity: topProducts[0].soldQuantity,
      unit: topProducts[0].unit,
    } : null;

    // Top sold crop (by quantity)
    const topSoldByQuantity = Object.values(productSales)
      .sort((a, b) => b.soldQuantity - a.soldQuantity)
      .slice(0, 1);

    const topSoldCrop = topSoldByQuantity.length > 0 ? {
      name: topSoldByQuantity[0].name,
      quantity: topSoldByQuantity[0].soldQuantity,
      unit: topSoldByQuantity[0].unit,
      revenue: topSoldByQuantity[0].revenue,
    } : null;

    // Products by category
    const productsByCategory: Record<string, number> = {};
    products?.forEach(product => {
      const category = product.category || 'uncategorized';
      productsByCategory[category] = (productsByCategory[category] || 0) + 1;
    });

    return {
      totalProducts,
      activeProducts,
      totalRevenue,
      totalOrders,
      pendingOrders,
      completedOrders,
      ordersByStatus,
      topProducts,
      productsByCategory,
      topRevenueCrop,
      topSoldCrop,
    };
  } catch (error) {
    console.error('Error fetching farmer analytics:', error);
    throw error;
  }
}

async function getAdminAnalytics(barangay: string) {
  try {
    // Get users in barangay
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, user_type, first_name, last_name, farm_name')
      .eq('barangay', barangay);

    if (usersError) throw usersError;

    const totalUsers = users?.length || 0;
    const farmers = users?.filter(u => u.user_type === 'farmer').length || 0;
    const buyers = users?.filter(u => u.user_type === 'buyer').length || 0;

    const farmerIds = users?.filter(u => u.user_type === 'farmer').map(u => u.id) || [];

    // Get products from farmers in barangay
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, status')
      .in('farmer_id', farmerIds);

    if (productsError) throw productsError;

    const totalProducts = products?.length || 0;
    const activeProducts = products?.filter(p => p.status === 'approved').length || 0;

    // Get orders from farmers in barangay
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_price,
        quantity,
        farmer_id,
        created_at,
        product:products(name, farmer_id),
        farmer:profiles!orders_farmer_id_fkey(first_name, last_name)
      `)
      .in('farmer_id', farmerIds);

    if (ordersError) throw ordersError;

    const totalOrders = orders?.length || 0;
    const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    orders?.forEach(order => {
      const status = order.status || 'unknown';
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });

    // Top farmers by revenue
    const farmerRevenue: Record<string, { name: string; farmName?: string; revenue: number }> = {};
    orders?.forEach(order => {
      const farmer = users?.find(u => u.id === order.farmer_id);
      if (farmer) {
        const farmerName = `${farmer.first_name} ${farmer.last_name}`;
        if (!farmerRevenue[farmerName]) {
          farmerRevenue[farmerName] = {
            name: farmerName,
            farmName: farmer.farm_name || undefined,
            revenue: 0,
          };
        }
        farmerRevenue[farmerName].revenue += order.total_price || 0;
      }
    });
    const topFarmers = Object.values(farmerRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top products
    const productRevenue: Record<string, { name: string; orderCount: number; revenue: number }> = {};
    orders?.forEach(order => {
      if (order.product) {
        const productName = (order.product as any).name;
        if (!productRevenue[productName]) {
          productRevenue[productName] = { name: productName, orderCount: 0, revenue: 0 };
        }
        productRevenue[productName].orderCount++;
        productRevenue[productName].revenue += order.total_price || 0;
      }
    });
    const topProducts = Object.values(productRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top crop this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thisMonthOrders = orders?.filter(o => {
      const orderDate = new Date(o.created_at);
      return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    }) || [];

    const monthlyProductStats: Record<string, { name: string; quantity: number; revenue: number; orderCount: number }> = {};
    thisMonthOrders.forEach(order => {
      if (order.product) {
        const productName = (order.product as any).name;
        if (!monthlyProductStats[productName]) {
          monthlyProductStats[productName] = { name: productName, quantity: 0, revenue: 0, orderCount: 0 };
        }
        monthlyProductStats[productName].quantity += order.quantity || 0;
        monthlyProductStats[productName].revenue += order.total_price || 0;
        monthlyProductStats[productName].orderCount++;
      }
    });

    const topCropThisMonth = Object.values(monthlyProductStats).length > 0
      ? Object.values(monthlyProductStats).sort((a, b) => b.revenue - a.revenue)[0]
      : null;

    // Highest crop bought (overall)
    const cropStats: Record<string, { name: string; quantity: number; revenue: number; sellerName: string }> = {};
    orders?.forEach(order => {
      if (order.product && order.farmer) {
        const productName = (order.product as any).name;
        const sellerName = `${(order.farmer as any).first_name} ${(order.farmer as any).last_name}`;
        if (!cropStats[productName]) {
          cropStats[productName] = { name: productName, quantity: 0, revenue: 0, sellerName };
        }
        cropStats[productName].quantity += order.quantity || 0;
        cropStats[productName].revenue += order.total_price || 0;
      }
    });

    const highestCropBought = Object.values(cropStats).length > 0
      ? Object.values(cropStats).sort((a, b) => b.quantity - a.quantity)[0]
      : null;

    // Highest crop in barangay (same as topCropThisMonth but for all time)
    const barangayCropStats: Record<string, { name: string; quantity: number; revenue: number; orderCount: number }> = {};
    orders?.forEach(order => {
      if (order.product) {
        const productName = (order.product as any).name;
        if (!barangayCropStats[productName]) {
          barangayCropStats[productName] = { name: productName, quantity: 0, revenue: 0, orderCount: 0 };
        }
        barangayCropStats[productName].quantity += order.quantity || 0;
        barangayCropStats[productName].revenue += order.total_price || 0;
        barangayCropStats[productName].orderCount++;
      }
    });

    const highestCropInBarangay = Object.values(barangayCropStats).length > 0
      ? Object.values(barangayCropStats).sort((a, b) => b.quantity - a.quantity)[0]
      : null;

    return {
      totalUsers,
      farmers,
      buyers,
      totalOrders,
      pendingOrders,
      totalProducts,
      activeProducts,
      totalRevenue,
      ordersByStatus,
      topFarmers,
      topProducts,
      topCropThisMonth,
      highestCropBought,
      highestCropInBarangay,
    };
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    throw error;
  }
}

async function getSuperAdminAnalytics() {
  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, user_type, barangay, verification_status');

    if (usersError) throw usersError;

    const totalUsers = users?.length || 0;
    const farmers = users?.filter(u => u.user_type === 'farmer').length || 0;
    const buyers = users?.filter(u => u.user_type === 'buyer').length || 0;
    const admins = users?.filter(u => u.user_type === 'admin').length || 0;
    const verifiedUsers = users?.filter(u => u.verification_status === 'verified').length || 0;
    const pendingVerifications = users?.filter(u => u.verification_status === 'pending').length || 0;

    // Get all products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, status, category, name');

    if (productsError) throw productsError;

    const totalProducts = products?.length || 0;
    const activeProducts = products?.filter(p => p.status === 'approved').length || 0;

    // Get all orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_price,
        quantity,
        farmer_id,
        created_at,
        product:products(name, category),
        farmer:profiles!orders_farmer_id_fkey(first_name, last_name)
      `);

    if (ordersError) throw ordersError;

    const totalOrders = orders?.length || 0;
    const completedOrders = orders?.filter(o => o.status === 'delivered').length || 0;
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    orders?.forEach(order => {
      const status = order.status || 'unknown';
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });

    // Barangay statistics
    const barangayMap: Record<string, { name: string; farmers: number; orders: number; revenue: number }> = {};
    users?.forEach(user => {
      if (user.barangay && user.user_type === 'farmer') {
        if (!barangayMap[user.barangay]) {
          barangayMap[user.barangay] = { name: user.barangay, farmers: 0, orders: 0, revenue: 0 };
        }
        barangayMap[user.barangay].farmers++;

        const farmerOrders = orders?.filter(o => o.farmer_id === user.id) || [];
        barangayMap[user.barangay].orders += farmerOrders.length;
        barangayMap[user.barangay].revenue += farmerOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
      }
    });
    const barangayStats = Object.values(barangayMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top products platform-wide
    const productRevenue: Record<string, { name: string; category: string; orderCount: number; revenue: number }> = {};
    orders?.forEach(order => {
      if (order.product) {
        const productName = (order.product as any).name;
        const category = (order.product as any).category || 'uncategorized';
        if (!productRevenue[productName]) {
          productRevenue[productName] = { name: productName, category, orderCount: 0, revenue: 0 };
        }
        productRevenue[productName].orderCount++;
        productRevenue[productName].revenue += order.total_price || 0;
      }
    });
    const topProducts = Object.values(productRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top crop this month (platform-wide)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thisMonthOrders = orders?.filter(o => {
      const orderDate = new Date(o.created_at);
      return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    }) || [];

    const monthlyProductStats: Record<string, { name: string; quantity: number; revenue: number; orderCount: number }> = {};
    thisMonthOrders.forEach(order => {
      if (order.product) {
        const productName = (order.product as any).name;
        if (!monthlyProductStats[productName]) {
          monthlyProductStats[productName] = { name: productName, quantity: 0, revenue: 0, orderCount: 0 };
        }
        monthlyProductStats[productName].quantity += order.quantity || 0;
        monthlyProductStats[productName].revenue += order.total_price || 0;
        monthlyProductStats[productName].orderCount++;
      }
    });

    const topCropThisMonth = Object.values(monthlyProductStats).length > 0
      ? Object.values(monthlyProductStats).sort((a, b) => b.revenue - a.revenue)[0]
      : null;

    // Highest crop bought platform-wide
    const cropStats: Record<string, { name: string; quantity: number; revenue: number; sellerName: string }> = {};
    orders?.forEach(order => {
      if (order.product && order.farmer) {
        const productName = (order.product as any).name;
        const sellerName = `${(order.farmer as any).first_name} ${(order.farmer as any).last_name}`;
        if (!cropStats[productName]) {
          cropStats[productName] = { name: productName, quantity: 0, revenue: 0, sellerName };
        }
        cropStats[productName].quantity += order.quantity || 0;
        cropStats[productName].revenue += order.total_price || 0;
      }
    });

    const highestCropBought = Object.values(cropStats).length > 0
      ? Object.values(cropStats).sort((a, b) => b.quantity - a.quantity)[0]
      : null;

    return {
      totalUsers,
      farmers,
      buyers,
      admins,
      totalOrders,
      completedOrders,
      totalProducts,
      activeProducts,
      totalRevenue,
      verifiedUsers,
      pendingVerifications,
      ordersByStatus,
      barangayStats,
      topProducts,
      topCropThisMonth,
      highestCropBought,
    };
  } catch (error) {
    console.error('Error fetching super admin analytics:', error);
    throw error;
  }
}

export async function getProductAnalytics(productId: string): Promise<ProductAnalytics> {
  try {
    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('name, unit, category')
      .eq('id', productId)
      .single();

    if (productError) throw productError;

    // Get all orders for this product
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        quantity,
        total_price,
        buyer_id,
        profiles:buyer_id(first_name, last_name)
      `)
      .eq('product_id', productId);

    if (ordersError) throw ordersError;

    const totalSold = orders?.reduce((sum, o) => sum + (o.quantity || 0), 0) || 0;
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;
    const totalOrders = orders?.length || 0;
    const averageOrderSize = totalOrders > 0 ? totalSold / totalOrders : 0;

    // Top buyers
    const buyerMap: Record<string, { buyerName: string; quantityPurchased: number; totalSpent: number }> = {};
    orders?.forEach(order => {
      const buyerId = order.buyer_id;
      const buyerProfile = order.profiles as any;
      const buyerName = buyerProfile ? `${buyerProfile.first_name} ${buyerProfile.last_name}` : 'Unknown';

      if (!buyerMap[buyerId]) {
        buyerMap[buyerId] = { buyerName, quantityPurchased: 0, totalSpent: 0 };
      }
      buyerMap[buyerId].quantityPurchased += order.quantity || 0;
      buyerMap[buyerId].totalSpent += order.total_price || 0;
    });

    const topBuyers = Object.values(buyerMap)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    return {
      productId,
      productName: product.name,
      totalSold,
      totalRevenue,
      totalOrders,
      averageOrderSize,
      unit: product.unit,
      category: product.category,
      topBuyers,
    };
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    throw error;
  }
}

export async function getUserAnalytics(userId: string, userType: 'farmer' | 'buyer'): Promise<UserAnalytics> {
  try {
    // Get user details
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('first_name, last_name, user_type')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const userName = `${user.first_name} ${user.last_name}`;

    if (userType === 'farmer') {
      // Get farmer's orders (sales)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total_price,
          quantity,
          product:products(name)
        `)
        .eq('farmer_id', userId);

      if (ordersError) throw ordersError;

      const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;
      const totalOrders = orders?.length || 0;

      // Top products sold
      const productMap: Record<string, { productName: string; quantity: number; amount: number }> = {};
      orders?.forEach(order => {
        if (order.product) {
          const productName = (order.product as any).name;
          if (!productMap[productName]) {
            productMap[productName] = { productName, quantity: 0, amount: 0 };
          }
          productMap[productName].quantity += order.quantity || 0;
          productMap[productName].amount += order.total_price || 0;
        }
      });

      const topProducts = Object.values(productMap)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return {
        userId,
        userName,
        userType: 'farmer',
        totalRevenue,
        totalOrders,
        topProducts,
      };
    } else {
      // Get buyer's orders (purchases)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total_price,
          quantity,
          product:products(name)
        `)
        .eq('buyer_id', userId);

      if (ordersError) throw ordersError;

      const totalSpent = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;
      const totalOrders = orders?.length || 0;

      // Top products purchased
      const productMap: Record<string, { productName: string; quantity: number; amount: number }> = {};
      orders?.forEach(order => {
        if (order.product) {
          const productName = (order.product as any).name;
          if (!productMap[productName]) {
            productMap[productName] = { productName, quantity: 0, amount: 0 };
          }
          productMap[productName].quantity += order.quantity || 0;
          productMap[productName].amount += order.total_price || 0;
        }
      });

      const topProducts = Object.values(productMap)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return {
        userId,
        userName,
        userType: 'buyer',
        totalSpent,
        totalOrders,
        topProducts,
      };
    }
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    throw error;
  }
}
