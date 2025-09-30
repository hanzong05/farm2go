import { supabase } from '../lib/supabase';

export interface Product {
  id: string;
  farmer_id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: string;
  quantity_available: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductWithFarmer extends Product {
  farmer_profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    farm_name: string | null;
    barangay: string | null;
  };
}

// Update product quantity (for inventory management)
export const updateProductQuantity = async (
  productId: string,
  newQuantity: number,
  farmerId?: string
): Promise<Product> => {
  try {
    // Get current product info
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !currentProduct) {
      throw new Error('Product not found');
    }

    // If farmerId is provided, verify ownership
    if (farmerId && currentProduct.farmer_id !== farmerId) {
      throw new Error('Unauthorized: You can only update your own products');
    }

    const { data, error } = await supabase
      .from('products')
      .update({
        quantity_available: newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      throw error;
    }


    return data as Product;
  } catch (error) {
    console.error('Error updating product quantity:', error);
    throw error;
  }
};

// Update product details
export const updateProduct = async (
  productId: string,
  updates: Partial<Product>,
  farmerId?: string
): Promise<Product> => {
  try {
    // Get current product to verify ownership
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('farmer_id, name')
      .eq('id', productId)
      .single();

    if (fetchError || !currentProduct) {
      throw new Error('Product not found');
    }

    // If farmerId is provided, verify ownership
    if (farmerId && currentProduct.farmer_id !== farmerId) {
      throw new Error('Unauthorized: You can only update your own products');
    }

    const { data, error } = await supabase
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      throw error;
    }


    return data as Product;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

// Get products by farmer
export const getFarmerProducts = async (farmerId: string): Promise<Product[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as Product[];
  } catch (error) {
    console.error('Error fetching farmer products:', error);
    throw error;
  }
};

// Get active products with farmer info
export const getActiveProducts = async (): Promise<ProductWithFarmer[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        farmer_profile:farmer_id (
          id,
          first_name,
          last_name,
          farm_name,
          barangay
        )
      `)
      .eq('is_active', true)
      .gt('quantity_available', 0)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as ProductWithFarmer[];
  } catch (error) {
    console.error('Error fetching active products:', error);
    throw error;
  }
};

// Real-time subscriptions for products

// Subscribe to product updates for a specific farmer
export const subscribeToFarmerProducts = (
  farmerId: string,
  callback: (product: Product, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
) => {
  const channel = supabase.channel(`farmer_products_${farmerId}`);

  ['INSERT', 'UPDATE', 'DELETE'].forEach(event => {
    channel.on(
      'postgres_changes',
      {
        event: event as any,
        schema: 'public',
        table: 'products',
        filter: `farmer_id.eq.${farmerId}`
      },
      (payload) => {
        console.log(`🥕 Product ${event.toLowerCase()} for farmer ${farmerId}:`, payload);
        callback(payload.new as Product, event as any);
      }
    );
  });

  return channel.subscribe((status) => {
    console.log(`🥕 Farmer products subscription status for ${farmerId}:`, status);
  });
};

// Subscribe to all product updates (for buyers to see inventory changes)
export const subscribeToAllProducts = (
  callback: (product: Product, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
) => {
  const channel = supabase.channel('all_products');

  ['INSERT', 'UPDATE', 'DELETE'].forEach(event => {
    channel.on(
      'postgres_changes',
      {
        event: event as any,
        schema: 'public',
        table: 'products'
      },
      (payload) => {
        console.log(`🥕 Product ${event.toLowerCase()}:`, payload);

        // Only notify about active products with stock for buyers
        const product = payload.new as Product;
        if (event === 'UPDATE' && product?.is_active && product?.quantity_available > 0) {
          callback(product, event as any);
        } else if (event === 'INSERT' && product?.is_active) {
          callback(product, event as any);
        } else if (event === 'DELETE') {
          callback(payload.old as Product, event as any);
        }
      }
    );
  });

  return channel.subscribe((status) => {
    console.log('🥕 All products subscription status:', status);
  });
};

// Subscribe to specific product updates
export const subscribeToProduct = (
  productId: string,
  callback: (product: Product, eventType: 'UPDATE' | 'DELETE') => void
) => {
  return supabase
    .channel(`product_${productId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'products',
        filter: `id.eq.${productId}`
      },
      (payload) => {
        console.log(`🥕 Product ${productId} updated:`, payload);
        callback(payload.new as Product, 'UPDATE');
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'products',
        filter: `id.eq.${productId}`
      },
      (payload) => {
        console.log(`🥕 Product ${productId} deleted:`, payload);
        callback(payload.old as Product, 'DELETE');
      }
    )
    .subscribe((status) => {
      console.log(`🥕 Product ${productId} subscription status:`, status);
    });
};

// Subscribe to low stock alerts (quantity <= 5)
export const subscribeToLowStock = (
  farmerId: string,
  callback: (product: Product) => void
) => {
  return supabase
    .channel(`low_stock_${farmerId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'products',
        filter: `farmer_id.eq.${farmerId}`
      },
      (payload) => {
        const product = payload.new as Product;
        if (product.quantity_available <= 5 && product.quantity_available > 0) {
          console.log(`⚠️ Low stock alert for product ${product.id}:`, product);
          callback(product);
        }
      }
    )
    .subscribe((status) => {
      console.log(`⚠️ Low stock subscription status for farmer ${farmerId}:`, status);
    });
};

// Get product by ID
export const getProductById = async (productId: string): Promise<ProductWithFarmer | null> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        farmer_profile:farmer_id (
          id,
          first_name,
          last_name,
          farm_name,
          barangay
        )
      `)
      .eq('id', productId)
      .single();

    if (error) {
      throw error;
    }

    return data as ProductWithFarmer;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
};