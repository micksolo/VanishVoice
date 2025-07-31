module.exports = ({ config }) => {
  return {
    ...config,
    // Add plugins for native module support
    plugins: [
      ...(config.plugins || []),
      // expo-dev-client plugin is automatically included when installed
      // react-native-compressor for video compression
      'react-native-compressor',
      // react-native-svg doesn't need a config plugin, it works natively in development builds
    ],
    // Configure iOS-specific settings for development builds
    ios: {
      ...config.ios,
      // Enable bitcode for better optimization (disabled by default in dev builds)
      bitcode: false,
    },
    // Configure Android-specific settings for development builds
    android: {
      ...config.android,
      // Enable Proguard/R8 minification in production builds
      enableProguardInReleaseBuilds: true,
      // Enable Hermes for better performance
      enableHermes: true,
    },
  };
};