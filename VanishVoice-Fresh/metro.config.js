const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enhanced resolver configuration to fix module resolution issues
config.resolver = {
  ...config.resolver,
  // Clear any existing extraNodeModules to avoid conflicts
  extraNodeModules: {
    'react-native': path.resolve(__dirname, 'node_modules/react-native'),
    'expo': path.resolve(__dirname, 'node_modules/expo'),
  },
  // Add nodeModulesPaths to ensure proper resolution
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
  ],
  // Disable symlinks to avoid resolution issues
  disableHierarchicalLookup: false,
};

module.exports = config;
