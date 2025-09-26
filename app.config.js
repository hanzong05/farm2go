import 'dotenv/config';

export default {
  expo: {
    name: "Farm2Go",
    slug: "farm2go",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/adaptive-icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/adaptive-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.farm2go.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.farm2go.app"
    },
    web: {
      favicon: "./assets/adaptive-icon.png",
      bundler: "metro"
    },
    plugins: [
      "expo-dev-client",
      [
        "expo-notifications",
        {
          icon: "./assets/adaptive-icon.png",
          color: "#ffffff",
          defaultChannel: "default"
        }
      ]
    ],
    extra: {
      eas: {
        projectId: process.env.EXPO_PROJECT_ID || "00000000-0000-0000-0000-000000000000"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      vapidPublicKey: process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY,
    }
  }
};