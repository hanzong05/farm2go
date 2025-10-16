# Map Production Build Fix

## Issues Identified

1. **Excessive Console Logging (84 statements)**
   - In production builds, excessive `console.log` statements can cause performance degradation and crashes
   - React Native optimizes away console statements in production, but excessive logging still impacts bundle size

2. **Missing Production Error Handling**
   - No error boundaries or fallback UI when MapView fails to load
   - Crashes were not being logged for debugging

3. **Google Maps API Configuration**
   - API key is correctly configured in:
     - AndroidManifest.xml (line 27)
     - app.json (android.config.googleMaps.apiKey)
   - However, the API key needs proper API enablement

## Fixes Applied

### 1. Safe Console Logging
Added development-only logging:
```typescript
const devLog = __DEV__ ? console.log : () => {};
const devWarn = __DEV__ ? console.warn : () => {};
const devError = __DEV__ ? console.error : () => {};
```

All 84 `console.*` statements replaced with `dev*` equivalents.

### 2. Error State Management
Added:
- `mapError` state to track and display errors
- `mapReady` state to track when map successfully loads
- Error UI with retry button and "Open in Google Maps" fallback

### 3. Production Error Logging
Integrated with `errorLogger` utility:
```typescript
if (!__DEV__) {
  errorLogger.logMapError(error);
}
```

### 4. Improved Error Handling
- MapView `onError` callback now sets error state instead of just logging
- Layout errors are caught and displayed
- Try-catch blocks enhanced with proper error propagation

## Google Maps API Setup Required

Your API key `AIzaSyA0M90dM91dZlLGAdCxMmeQggwGLOoWSyE` needs these APIs enabled:

1. **Maps SDK for Android** - For displaying maps
2. **Directions API** (optional) - If using Google Directions instead of OSRM
3. **Geocoding API** (optional) - If using Google Geocoding instead of Nominatim

### Steps to Enable:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to "APIs & Services" > "Library"
4. Search for and enable:
   - **Maps SDK for Android**
   - **Maps SDK for iOS** (if building for iOS)
5. Check API Key restrictions:
   - Navigate to "APIs & Services" > "Credentials"
   - Click on your API key
   - Under "API restrictions", ensure Maps SDK for Android is allowed
   - Under "Application restrictions", add your package name: `com.hanzpillerva.farm2go`

## Testing the Fix

### Development Build
```bash
npx expo start
# Then press 'a' for Android
```

### Production Build
```bash
# Clean build
npx expo run:android --variant release

# Or build APK
cd android
./gradlew assembleRelease
```

## Debugging Production Issues

If the map still doesn't work in production:

1. **Check Logcat for errors:**
   ```bash
   adb logcat | grep -i "google\|maps\|api"
   ```

2. **View error logs in app:**
   - Navigate to `/debug-logs` screen in your app
   - Check for MapView errors logged by `errorLogger`

3. **Verify API Key:**
   ```bash
   # Check AndroidManifest.xml contains the key
   cat android/app/src/main/AndroidManifest.xml | grep "API_KEY"
   ```

4. **Test API Key:**
   ```bash
   # Test if API key works
   curl "https://maps.googleapis.com/maps/api/directions/json?origin=14.5995,120.9842&destination=14.6091,121.0223&key=YOUR_API_KEY"
   ```

## Fallback Behavior

If MapView fails to load, users can:
1. Click "Retry" to attempt loading again
2. Click "Open in Google Maps" to view directions in external app

This ensures users can still navigate even if the in-app map fails.

## Files Modified

- `components/MapDirectionsModal.tsx` - All fixes applied here
- `utils/errorLogger.ts` - Sentry dependency removed (already done)

## Next Steps

1. Enable required Google Maps APIs in Cloud Console
2. Test production build
3. Monitor error logs via `/debug-logs` screen
4. If issues persist, check API key billing and quotas
