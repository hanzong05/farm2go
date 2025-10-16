import * as Sentry from '@sentry/react-native';

// Initialize Sentry
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '', // You'll get this from Sentry dashboard

  // Set to true to enable debug mode (shows what Sentry is doing)
  debug: __DEV__,

  // Set environment
  environment: __DEV__ ? 'development' : 'production',

  // Enable native crash tracking
  enableNative: true,

  // Enable auto session tracking
  enableAutoSessionTracking: true,

  // Track app start time
  enableAppStartTracking: true,

  // Performance monitoring (optional)
  tracesSampleRate: 1.0, // Capture 100% of transactions in production (adjust as needed)

  // Integrations
  integrations: [
    new Sentry.ReactNativeTracing({
      routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
    }),
  ],

  // Before send hook - you can modify or filter events
  beforeSend(event, hint) {
    // Log to console in development
    if (__DEV__) {
      console.log('Sentry Event:', event);
      console.log('Sentry Hint:', hint);
    }
    return event;
  },
});

export default Sentry;
