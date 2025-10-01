# Debugging: No Orders Showing in My Orders Page

## Quick Diagnosis Steps

### Step 1: Check Console Logs

Open your browser console (F12) and look for these log messages:

```
📦 Loading orders for buyer: [user-id]
📦 Orders loaded: [number]
📦 Orders data: [json data]
```

**If you see:** `📦 Orders loaded: 0` → **You have no orders in the database**

### Step 2: Verify You Have Orders in Database

Run this query in Supabase SQL Editor:

```sql
-- Replace 'YOUR_USER_ID' with your actual user ID from the logs
SELECT * FROM orders WHERE buyer_id = 'YOUR_USER_ID';
```

**If query returns 0 rows:** You need to create an order first!

### Step 3: Create a Test Order

1. Go to **Marketplace** (Home page `/`)
2. Click on any product
3. Add it to cart and complete the purchase
4. Go back to **My Orders** page

### Step 4: Check Filter Logs

Look for these in console:

```
🔍 Starting filter with [X] orders
🔍 Selected status: all
🔍 After status filter: [X] orders
🔍 Final filtered count: [X]
```

**If initial count > 0 but final count = 0:** The filters are hiding your orders!

## Common Issues & Solutions

### Issue 1: No Orders in Database
**Symptom:** `📦 Orders loaded: 0`

**Solution:**
1. Create an order from Marketplace
2. Or insert a test order in Supabase:

```sql
INSERT INTO orders (
  buyer_id,
  farmer_id,
  product_id,
  quantity,
  total_price,
  status,
  delivery_address
) VALUES (
  'YOUR_BUYER_ID',
  (SELECT farmer_id FROM products LIMIT 1),
  (SELECT id FROM products LIMIT 1),
  2,
  100.00,
  'pending',
  '123 Test Street, Test City'
);
```

### Issue 2: Status Filter Hiding Orders
**Symptom:** Filter logs show orders being filtered out

**Solution:**
- Click "All" tab at the top of My Orders page
- This resets the status filter

### Issue 3: Database Query Error
**Symptom:** Error in console logs

**Solution:**
Check Supabase RLS (Row Level Security) policies:

```sql
-- Check if buyer can read their own orders
SELECT * FROM orders
WHERE buyer_id = auth.uid()
LIMIT 1;
```

If this fails, add RLS policy:

```sql
CREATE POLICY "Buyers can view own orders"
ON orders FOR SELECT
USING (auth.uid() = buyer_id);
```

### Issue 4: Wrong User Type
**Symptom:** You're logged in as a farmer, not a buyer

**Solution:**
1. Check user type in console: Look for `User data:` log
2. Should show `user_type: 'buyer'`
3. If it shows `farmer`, you need to log in with a buyer account

## Quick Test Script

Run this in browser console to test:

```javascript
// Check current user
const { data: { user } } = await supabase.auth.getUser();
console.log('Current User ID:', user?.id);

// Check orders for this user
const { data: orders, error } = await supabase
  .from('orders')
  .select('*')
  .eq('buyer_id', user?.id);

console.log('Orders count:', orders?.length);
console.log('Orders:', orders);
console.log('Error:', error);
```

## Expected Console Output (Working)

```
📦 Loading orders for buyer: abc123...
📦 Orders loaded: 3
📦 Orders data: [
  {
    "id": "order-1",
    "status": "pending",
    "total_price": 150.00,
    "product": { "name": "Tomatoes" },
    ...
  },
  ...
]
🔍 Starting filter with 3 orders
🔍 Selected status: all
🔍 Final filtered count: 3
```

## Still Not Working?

1. **Take a screenshot** of your console logs
2. **Export your orders table** from Supabase
3. **Check** that the table structure matches:

```sql
\d orders
```

Should include:
- id (uuid)
- buyer_id (uuid)
- farmer_id (uuid)
- product_id (uuid)
- quantity (numeric)
- total_price (numeric)
- status (text)
- delivery_address (text)
- created_at (timestamp)

## Next Steps

After checking these, if still not working:

1. Share your console logs
2. Share the result of: `SELECT COUNT(*) FROM orders WHERE buyer_id = 'YOUR_ID';`
3. Confirm your user_type is 'buyer'
