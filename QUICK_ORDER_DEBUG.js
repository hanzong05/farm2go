/**
 * QUICK ORDER DEBUG SCRIPT
 *
 * Copy and paste this entire script into your browser console
 * while on the "My Orders" page to diagnose why orders aren't showing
 */

console.log('🔍 === STARTING ORDER DEBUG DIAGNOSTICS ===');

// Step 1: Check authentication
(async () => {
  try {
    console.log('\n📋 Step 1: Checking authentication...');

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }

    if (!user) {
      console.error('❌ No user logged in!');
      return;
    }

    console.log('✅ User logged in:', user.id);
    console.log('✅ User email:', user.email);

    // Step 2: Check profile
    console.log('\n📋 Step 2: Checking user profile...');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile error:', profileError);
      return;
    }

    console.log('✅ Profile found:', profile);
    console.log('✅ User type:', profile.user_type);

    if (profile.user_type !== 'buyer') {
      console.warn('⚠️ WARNING: User type is not "buyer"! Current type:', profile.user_type);
      console.warn('⚠️ You need to be logged in as a buyer to see orders on this page');
    }

    // Step 3: Check orders in database
    console.log('\n📋 Step 3: Checking orders in database...');

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        products:product_id (
          id,
          name,
          description,
          price,
          unit,
          category,
          image_url
        ),
        profiles:farmer_id (
          id,
          email,
          first_name,
          last_name,
          farm_name,
          barangay
        ),
        transactions (
          id,
          amount,
          status,
          payment_method,
          created_at,
          updated_at
        )
      `)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('❌ Orders query error:', ordersError);
      console.error('❌ Error details:', JSON.stringify(ordersError, null, 2));

      if (ordersError.code === 'PGRST116') {
        console.error('❌ This error usually means RLS (Row Level Security) is blocking access');
        console.error('❌ Check your Supabase RLS policies for the orders table');
      }
      return;
    }

    console.log('✅ Orders query successful!');
    console.log('✅ Number of orders found:', orders?.length || 0);

    if (!orders || orders.length === 0) {
      console.warn('⚠️ NO ORDERS FOUND IN DATABASE!');
      console.warn('⚠️ This user has no orders. Create an order first:');
      console.warn('   1. Go to Marketplace');
      console.warn('   2. Buy a product');
      console.warn('   3. Come back to My Orders');
      return;
    }

    // Step 4: Inspect order structure
    console.log('\n📋 Step 4: Inspecting order structure...');
    console.log('✅ First order (raw):', JSON.stringify(orders[0], null, 2));

    // Check for missing fields
    const firstOrder = orders[0];
    const requiredFields = ['id', 'buyer_id', 'farmer_id', 'product_id', 'status', 'total_price'];
    const missingFields = requiredFields.filter(field => !firstOrder[field]);

    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
    } else {
      console.log('✅ All required fields present');
    }

    // Check product data
    if (!firstOrder.products && !firstOrder.product) {
      console.error('❌ Product data missing! This will cause rendering issues');
      console.error('❌ Expected "products" or "product" field in order');
    } else {
      console.log('✅ Product data found:', firstOrder.products || firstOrder.product);
    }

    // Check farmer profile
    if (!firstOrder.profiles && !firstOrder.farmer_profile) {
      console.error('❌ Farmer profile missing! This might cause issues');
    } else {
      console.log('✅ Farmer profile found:', firstOrder.profiles || firstOrder.farmer_profile);
    }

    // Step 5: Test data mapping
    console.log('\n📋 Step 5: Testing data mapping...');

    const mappedOrder = {
      ...firstOrder,
      product: firstOrder.products,
      farmer_profile: firstOrder.profiles,
      transaction: firstOrder.transactions?.[0]
    };

    console.log('✅ Mapped order:', mappedOrder);
    console.log('✅ Product name:', mappedOrder.product?.name);
    console.log('✅ Total price:', mappedOrder.total_price);
    console.log('✅ Status:', mappedOrder.status);

    // Step 6: Check for filter issues
    console.log('\n📋 Step 6: Checking order statuses...');

    const statusCounts = {};
    orders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    console.log('✅ Orders by status:', statusCounts);
    console.log('ℹ️ If you have status filter active, make sure it matches your orders');

    // Summary
    console.log('\n✅ === DIAGNOSTICS COMPLETE ===');
    console.log(`Found ${orders.length} order(s) for buyer ${user.id}`);
    console.log('If orders still don\'t show, check the render logs (🎨 emoji)');

  } catch (error) {
    console.error('❌ Unexpected error during diagnostics:', error);
  }
})();
