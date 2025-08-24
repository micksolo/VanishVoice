/**
 * Debug Configuration for VanishVoice
 * Central place to control logging across the app
 */

// Debug mode flags - set to false to disable specific log categories
export const DEBUG_CONFIG = {
  // Screenshot-related logs (keep these ON for debugging)
  SCREENSHOT: true,
  SCREENSHOT_NATIVE: true,
  SCREENSHOT_DETECTION: true,
  SCREENSHOT_NOTIFICATIONS: true,
  
  // Chat and messaging logs (turn OFF to reduce noise)
  READ_RECEIPTS: false,  // Was true, causing massive log spam
  CHAT: false,           // Was true, causing polling logs
  REALTIME: false,       // Supabase realtime connection logs
  
  // Other categories (keep minimal)
  AUTH: false,
  PERMISSIONS: false,
  PUSH_NOTIFICATIONS: false,
  MONETIZATION: false,
  MATCHING: false,
  EPHEMERAL: false,
};

// Temporary debug mode - can be toggled at runtime
let temporaryDebugMode = false;

export const setTemporaryDebugMode = (enabled: boolean) => {
  temporaryDebugMode = enabled;
};

export const isTemporaryDebugMode = () => temporaryDebugMode;

// Helper functions for conditional logging
export const debugLog = (category: keyof typeof DEBUG_CONFIG, message: string, ...args: any[]) => {
  if (DEBUG_CONFIG[category] || temporaryDebugMode) {
    console.log(`[${category}] ${message}`, ...args);
  }
};

export const debugWarn = (category: keyof typeof DEBUG_CONFIG, message: string, ...args: any[]) => {
  if (DEBUG_CONFIG[category] || temporaryDebugMode) {
    console.warn(`[${category}] ${message}`, ...args);
  }
};

export const debugError = (category: keyof typeof DEBUG_CONFIG, message: string, ...args: any[]) => {
  if (DEBUG_CONFIG[category] || temporaryDebugMode) {
    console.error(`[${category}] ${message}`, ...args);
  }
};

// Screenshot-specific debug helpers (always enabled for debugging)
export const screenshotLog = (message: string, ...args: any[]) => {
  if (DEBUG_CONFIG.SCREENSHOT) {
    console.log(`[Screenshot] ${message}`, ...args);
  }
};

export const screenshotWarn = (message: string, ...args: any[]) => {
  if (DEBUG_CONFIG.SCREENSHOT) {
    console.warn(`[Screenshot] ${message}`, ...args);
  }
};

export const screenshotError = (message: string, ...args: any[]) => {
  if (DEBUG_CONFIG.SCREENSHOT) {
    console.error(`[Screenshot] ${message}`, ...args);
  }
};

// Quick toggle for testing
export const enableAllDebugLogs = () => {
  Object.keys(DEBUG_CONFIG).forEach(key => {
    (DEBUG_CONFIG as any)[key] = true;
  });
  console.log('🔧 All debug logs enabled');
};

export const disableNoisyLogs = () => {
  DEBUG_CONFIG.READ_RECEIPTS = false;
  DEBUG_CONFIG.CHAT = false;
  DEBUG_CONFIG.REALTIME = false;
  DEBUG_CONFIG.EPHEMERAL = false;
  console.log('🔇 Noisy logs disabled, screenshot logs remain active');
};