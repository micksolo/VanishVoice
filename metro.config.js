const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for Supabase and other packages that use Node.js modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (['stream', 'crypto', 'events', 'http', 'https', 'zlib', 'url', 'net', 'tls', 'fs', 'dns'].includes(moduleName)) {
    return {
      type: 'empty',
    };
  }
  
  // Ensure we return `null` and not `undefined` for the default case
  return context.resolveRequest(context, moduleName, platform);
};

// Add alias for ws to avoid WebSocket issues
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ws: require.resolve('./src/utils/ws-polyfill.js'),
};

// Support for development builds with native modules
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Enable support for native modules in development builds
config.watchFolders = [
  ...config.watchFolders || [],
  // Add any native module directories here if needed
];

// Clear Metro cache on start to avoid issues with native modules
config.resetCache = true;

module.exports = config;