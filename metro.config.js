const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add platform-specific file extensions
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add platform-specific resolver
config.resolver.resolverMainFields = ['browser', 'main'];

// Exclude VisionCamera from web builds
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-vision-camera') {
    // Return a mock module for web
    return {
      type: 'empty',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;