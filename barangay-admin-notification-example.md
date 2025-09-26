# Barangay Admin Notifications

## How It Works

When a buyer purchases from a farmer, the system now sends notifications to:

1. **Buyer**: Order confirmation
2. **Farmer**: New order received
3. **Barangay Admins**: Local order activity (NEW!)

## Example Scenario

**Setup:**
- Farmer: Juan Cruz from "Barangay San Jose"
- Buyer: Maria Santos from "Barangay Poblacion"
- Admin: Pedro Admin from "Barangay San Jose" (same as farmer)
- Product: Fresh Tomatoes - 5kg for ₱250

**When Maria places an order:**

### 1. Buyer Notification (Maria)
```
🛒 Order Placed Successfully
Your order for 1 item(s) totaling ₱250.00 has been placed and sent to the farmer.
```

### 2. Farmer Notification (Juan)
```
📦 New Order Received
You have a new order from Maria Santos for 1 item(s) worth ₱250.00.
```

### 3. Barangay Admin Notification (Pedro) - NEW!
```
🏘️ New Order Activity
[Barangay San Jose] Maria Santos placed an order with farmer Juan Cruz for Fresh Tomatoes worth ₱250.00.
```

## Key Features

- **Location-based**: Only admins in the farmer's barangay get notified
- **Detailed info**: Includes buyer name, farmer name, product, and amount
- **Clear labeling**: Messages are prefixed with 🏘️ and include barangay name
- **Action data**: Contains all order details for admin dashboard integration

## Benefits

- **Local oversight**: Admins can monitor agricultural activity in their area
- **Quick response**: Local admins can provide faster support if needed
- **Community awareness**: Helps track local farming business activity
- **Targeted notifications**: Only relevant admins are notified, reducing spam