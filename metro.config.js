const { getDefaultConfig } = require('expo/metro-config');

// Get the default Expo Metro config
const config = getDefaultConfig(__dirname);

// Only add minimal necessary overrides
config.resolver.sourceExts.push('cjs');

module.exports = config;