# Production Debugging Guide for Farm2Go

Your app crashes in production but not in debug mode. This guide provides multiple ways to debug production issues.

## Option 1: Sentry (Recommended - Free for small apps)

Sentry captures crashes and errors in production apps with full stack traces.

### Setup Steps:

1. **Create Free Sentry Account**
   - Go to https://sentry.io/signup/
   - Create a free account (supports up to 5,000 events/month)
   - Create a new project and select "React Native"

2. **Get Your DSN**
   - After creating the project, copy your DSN (looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)

3. **Add DSN to Environment Variables**
   ```bash
   # Add to your .env file
   EXPO_PUBLIC_SENTRY_DSN=your_dsn_here
   ```

4. **Build and Test**
   ```bash
   # Build production APK
   eas build --platform android --profile production

   # Or use local build
   npx expo run:android --variant release
   ```

5. **View Errors**
   - Install the APK on your device
   - Open the map (or do whatever causes the crash)
   - Go to Sentry dashboard to see the crash details with full stack trace

### What Sentry Captures:
- ✅ Crash reports with stack traces
- ✅ User actions before crash (breadcrumbs)
- ✅ Device info (OS version, model, etc.)
- ✅ Network requests
- ✅ Performance metrics

---

## Option 2: React Native Debugger with Production Build

You can use React Native Debugger even with production builds.

### Steps:

1. **Enable Debugging in Production Build**
   ```bash
   # Build with debugging enabled
   npx expo run:android --variant release --no-dev=false
   ```

2. **Use Flipper**
   - Install Flipper: https://fbflipper.com/
   - Run your production app
   - Flipper will show crashes and logs

---

## Option 3: Local Crash Logging (No External Service)

If you don't want to use external services, use local logging.

### We've already set this up for you:

The app now includes local error logging that writes to device storage.

**View logs:**
```bash
# For Android
adb pull /storage/emulated/0/Android/data/com.farm2go.app/files/error-logs

# Or use adb logcat
adb logcat | grep "Farm2Go"
```

---

## Option 4: Test Production APK with ADB Logcat

This is the fastest way to debug production crashes.

### Steps:

1. **Build Production APK**
   ```bash
   eas build --platform android --profile production
   # or
   npx expo run:android --variant release
   ```

2. **Install and Run with ADB Logcat**
   ```bash
   # Clear previous logs
   adb logcat -c

   # Start logging
   adb logcat | grep -E "Farm2Go|ReactNative|AndroidRuntime|DEBUG"

   # In another terminal, launch the app
   adb shell am start -n com.farm2go.app/.MainActivity
   ```

3. **Reproduce the Crash**
   - Open the map in your app
   - Watch the terminal for crash logs

4. **Common Map Crash Issues:**
   - Missing Google Maps API key in production
   - ProGuard removing required classes
   - Missing permissions in AndroidManifest.xml

---

## Specific Map Crash Debugging

Since you mentioned the map crashes in production, here are common issues:

### 1. Check Google Maps API Key

Make sure your Google Maps API key is in `app.json`:

```json
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

### 2. Check ProGuard Rules

If using ProGuard, you may need to add rules to prevent stripping Google Maps classes.

Create/edit `android/app/proguard-rules.pro`:

```proguard
# Google Maps
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
-dontwarn com.google.android.gms.**

# React Native Maps
-keep class com.airbnb.android.react.maps.** { *; }
-keep interface com.airbnb.android.react.maps.** { *; }
```

### 3. Check Permissions

Ensure `AndroidManifest.xml` has:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />

<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="YOUR_API_KEY"/>
```

---

## Quick Debug Commands

```bash
# 1. Build production APK with debugging symbols
eas build --platform android --profile preview

# 2. Install and watch logs
adb install app-release.apk && adb logcat -c && adb logcat | grep -E "Farm2Go|ReactNative|AndroidRuntime"

# 3. Get crash dump
adb logcat -d > crash_log.txt

# 4. Check if Maps library is loaded
adb logcat | grep -i "google\|maps"
```

---

## Recommended Workflow:

1. **Start with ADB Logcat** (fastest, free)
2. **If stack trace is unclear**, use **Sentry** (free tier is generous)
3. **For ongoing monitoring**, keep **Sentry** enabled in production

---

## Need Help?

If you're still stuck:
1. Share the ADB logcat output
2. Check if it's a Google Maps API key issue
3. Verify ProGuard isn't stripping necessary classes

