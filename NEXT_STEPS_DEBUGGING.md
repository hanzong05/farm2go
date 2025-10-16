# Next Steps: Debug Your Production Map Crash

## ✅ Sentry is Now Configured!

Your Sentry DSN has been added and the app is ready to track production errors.

## 🚀 Quick Steps to Debug Your Map Crash:

### Option 1: Build Production APK and Let Sentry Capture the Crash

1. **Build production APK:**
   ```bash
   eas build --platform android --profile production
   ```

2. **Install the APK on your device**

3. **Open the map and let it crash**

4. **Go to your Sentry dashboard:**
   - https://sentry.io/organizations/YOUR_ORG/issues/
   - You'll see the crash with full stack trace
   - Device info, breadcrumbs, and exact error location

### Option 2: Use ADB Logcat (Faster)

If you want immediate feedback without waiting for Sentry:

```bash
# Run the helper script
debug-production.bat

# Or manually:
npx expo run:android --variant release
adb logcat -c
adb logcat | grep -E "Farm2Go|ReactNative|Maps|Google|AndroidRuntime"
```

### Option 3: Test Sentry First

1. **Build a test version:**
   ```bash
   npx expo run:android --variant release
   ```

2. **Navigate to the debug logs screen in your app:**
   - Add a button somewhere to navigate to `/debug-logs`
   - Or manually navigate: `adb shell am start -a android.intent.action.VIEW -d "farm2go://debug-logs" com.farm2go.app`

3. **Tap "Send Test Error"** to verify Sentry is working

4. **Check Sentry dashboard** - you should see the test error within seconds

---

## 🗺️ Common Map Crash Causes:

### 1. Missing Google Maps API Key in Production

**Check:** Does your `app.json` or `android/app/src/main/AndroidManifest.xml` have the API key?

```json
// app.json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_API_KEY_HERE"
        }
      }
    }
  }
}
```

### 2. ProGuard Stripping Maps Classes

**Fix:** Add ProGuard rules (if using ProGuard):

```proguard
# android/app/proguard-rules.pro
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
-dontwarn com.google.android.gms.**
```

### 3. Missing Permissions

**Check `AndroidManifest.xml`:**

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />

<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="YOUR_API_KEY"/>
```

---

## 📊 What Sentry Will Show You:

When the map crashes, Sentry will capture:

1. **Exact Error Message**
   - `TypeError: Cannot read property 'lat' of undefined`
   - `ReferenceError: GoogleMaps is not defined`
   - etc.

2. **Full Stack Trace**
   - Exact line number where crash occurred
   - Function call chain
   - Source maps for React Native code

3. **Breadcrumbs**
   - User actions before crash
   - Network requests
   - Navigation history

4. **Device Context**
   - Android version
   - Device model
   - App version
   - Memory usage

---

## 🎯 Recommended Approach:

1. **Build production APK** (`eas build` or `npx expo run:android --variant release`)
2. **Install on device**
3. **Reproduce the map crash**
4. **Check Sentry dashboard** (errors appear within 1-2 minutes)
5. **Fix the issue based on the stack trace**
6. **Rebuild and test**

---

## 💡 Pro Tips:

- Sentry free tier gives you 5,000 events/month (plenty for debugging)
- Stack traces will show the exact component and line causing the crash
- You can add custom context to errors using `Sentry.setContext()`
- Sentry works in both production and staging builds

---

## Need Help?

If you see the error in Sentry and need help interpreting it, share:
1. The error message
2. The stack trace
3. The breadcrumbs (user actions before crash)

