# Barangay Sync Point - Map Directions Feature

## Overview
The Barangay Sync Point feature allows buyers to view directions from their current location to the delivery address of their orders using various map applications.

## Features

### 1. **Location-Based Navigation**
- Automatically detects the buyer's current location
- Shows real-time GPS coordinates
- Calculates directions to the delivery address

### 2. **Multiple Map App Support**
- **Google Maps**: Turn-by-turn navigation with traffic updates
- **Waze**: Real-time traffic and community-based navigation
- **Apple Maps**: Native iOS maps (iOS only)

### 3. **Order Information Display**
- Shows order ID, product name, and current status
- Displays delivery address prominently
- Highlights current location coordinates

## How to Use

### For Buyers:

1. **Access Your Orders**
   - Navigate to "My Orders" screen
   - View your list of orders

2. **Get Directions**
   - Find the order you want directions for
   - Click the "📍 Directions" button next to "Show QR Code"
   - The system will request location permissions (first time only)

3. **Choose Navigation App**
   - Once your location is detected, choose from:
     - Google Maps
     - Waze
     - Apple Maps (iOS only)
   - Click on your preferred app to open navigation

4. **Navigate to Delivery Location**
   - The selected map app will open with directions
   - Follow the turn-by-turn instructions

## Technical Implementation

### Components Used:

#### `MapDirectionsModal.tsx`
- Modal component for displaying map options
- Handles location permissions using `expo-location`
- Opens external map applications using deep links
- Shows order information and delivery address

#### Modified Files:
- `app/buyer/my-orders.tsx`: Added direction button and modal integration
- `package.json`: Added `expo-location` dependency

### Location Permissions

The app requests foreground location permissions to:
- Get the buyer's current GPS coordinates
- Calculate distance to delivery address
- Provide accurate navigation

### Deep Linking

The feature uses deep links to open map applications:

```javascript
// Google Maps
comgooglemaps://?saddr=lat,lng&daddr=address

// Waze
https://waze.com/ul?ll=lat,lng&navigate=yes&q=address

// Apple Maps
http://maps.apple.com/?saddr=lat,lng&daddr=address
```

## UI/UX Design

### Button Placement
- Located in the action buttons row of each order card
- Positioned next to the "Show QR Code" button
- Uses a distinct blue color (#3b82f6) for easy identification
- Includes a map pin emoji (📍) for visual recognition

### Modal Design
- Clean, modern interface
- Shows order details at the top
- Highlights delivery address in yellow
- Displays current location in green
- Large, easy-to-tap buttons for map selection

### User Flow
1. Tap "Directions" button
2. Grant location permission (if needed)
3. View order and address details
4. Choose preferred map app
5. Navigate to delivery location

## Error Handling

The feature handles various scenarios:

1. **No Location Permission**: Shows message and retry button
2. **Location Unavailable**: Displays error with retry option
3. **No Delivery Address**: Alert shown, button disabled
4. **Map App Not Installed**: Falls back to web version (Google Maps)

## Future Enhancements

Possible improvements:
1. **In-app map view**: Show embedded map with route
2. **Distance calculation**: Display distance and estimated time
3. **Barangay sync points**: Show nearby pickup/delivery points
4. **Navigation history**: Save recent navigation routes
5. **Multiple waypoints**: Add stops along the route
6. **Real-time tracking**: Track delivery progress

## Dependencies

```json
{
  "expo-location": "~18.0.7"
}
```

## Platform Support

- ✅ iOS
- ✅ Android
- ⚠️ Web (limited - requires browser location permission)

## Privacy & Security

- Location data is only used during navigation
- No location data is stored or transmitted to servers
- Location permission can be revoked in device settings
- Only accessed when user explicitly requests directions

## Testing

To test the feature:

1. Create a test order with a valid delivery address
2. Grant location permissions when prompted
3. Verify current location is accurate
4. Test each map app option
5. Ensure navigation opens correctly
6. Test permission denial scenarios

## Support

For issues or questions:
- Check that location services are enabled on device
- Ensure the delivery address is valid
- Verify map apps are installed
- Check network connectivity
