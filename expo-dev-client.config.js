module.exports = {
  // Development client configuration
  developmentClient: {
    // Enable hot reloading for native modules
    enableHotReload: true,
    
    // Configure native module support
    nativeModules: {
      // Allow native modules to be added
      enabled: true,
      
      // Autolinking configuration
      autolink: {
        enabled: true,
        exclude: []
      }
    },
    
    // Configure build-time environment
    buildEnvironment: {
      // Disable new architecture until stack is aligned
      newArchEnabled: false,
      
      // Configure metro bundler
      metro: {
        // Reset cache when native modules change
        resetCache: true
      }
    }
  }
};