/**
 * Development Tools - Debug Mode Controls
 * Quick utilities to toggle debug modes at runtime
 */

import { DEBUG_CONFIG, setTemporaryDebugMode, disableNoisyLogs, enableAllDebugLogs } from './debugConfig';

// Create a global function accessible in dev tools
declare global {
  interface Window {
    devTools: {
      enableDebugMode: () => void;
      disableDebugMode: () => void;
      screenshotDebugOnly: () => void;
      enableAllLogs: () => void;
      showDebugConfig: () => void;
    };
  }
}

const devTools = {
  // Enable temporary debug mode (all logs)
  enableDebugMode: () => {
    setTemporaryDebugMode(true);
    console.log('🔧 [DevTools] All debug logs enabled temporarily');
    console.log('🔧 [DevTools] Use devTools.disableDebugMode() to turn off');
  },

  // Disable temporary debug mode
  disableDebugMode: () => {
    setTemporaryDebugMode(false);
    console.log('🔇 [DevTools] Temporary debug mode disabled');
  },

  // Screenshot debugging only
  screenshotDebugOnly: () => {
    disableNoisyLogs();
    console.log('📸 [DevTools] Screenshot debug mode: Only screenshot logs will show');
    console.log('📸 [DevTools] Polling and read receipt logs are now disabled');
  },

  // Enable all logs permanently
  enableAllLogs: () => {
    enableAllDebugLogs();
    console.log('🔊 [DevTools] All debug categories enabled permanently');
  },

  // Show current debug configuration
  showDebugConfig: () => {
    console.log('🔧 [DevTools] Current debug configuration:');
    Object.entries(DEBUG_CONFIG).forEach(([key, value]) => {
      console.log(`  ${key}: ${value ? '✅' : '❌'}`);
    });
  }
};

// Make devTools globally available in development
if (__DEV__) {
  (global as any).devTools = devTools;
  console.log('🔧 [DevTools] Development tools loaded. Use devTools.* in console:');
  console.log('  - devTools.screenshotDebugOnly() - Only screenshot logs');
  console.log('  - devTools.enableDebugMode() - All logs temporarily');
  console.log('  - devTools.disableDebugMode() - Turn off temporary mode');
  console.log('  - devTools.showDebugConfig() - Show current config');
}

export default devTools;