const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// NUCLEAR OPTION: Complete module resolution override
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

config.watchFolders = [workspaceRoot];
config.resolver = {
  // Use Node.js module resolution instead of Metro's custom resolver
  disableHierarchicalLookup: false,
  platforms: ['ios', 'android', 'native', 'web'],
  alias: {
    // Explicit alias for the problematic module
    '@babel/runtime/helpers/interopRequireDefault': path.resolve(
      projectRoot,
      'node_modules/@babel/runtime/helpers/interopRequireDefault.js'
    ),
    '@babel/runtime': path.resolve(projectRoot, 'node_modules/@babel/runtime'),
  },
  resolverMainFields: ['react-native', 'browser', 'main'],
  sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json'],
  assetExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ttf', 'otf', 'woff', 'woff2'],
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
  ],
};

module.exports = config;