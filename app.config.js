import 'dotenv/config';

export default {
  expo: {
    name: "Farm2Go",
    slug: "farm2go",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "farm2go",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/images/splash-icon.png",
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
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#059669"
      },
      package: "com.farm2go.app",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "farm2go",
              host: "*"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ]
    },
    web: {
      favicon: "./assets/images/icon.png",
      bundler: "metro"
    },
    plugins: [
      // "expo-dev-client", // Temporarily disabled to debug map crash
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#059669",
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