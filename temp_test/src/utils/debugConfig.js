"use strict";
/**
 * Debug Configuration for VanishVoice
 * Central place to control logging across the app
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.disableNoisyLogs = exports.enableAllDebugLogs = exports.screenshotError = exports.screenshotWarn = exports.screenshotLog = exports.debugError = exports.debugWarn = exports.debugLog = exports.isTemporaryDebugMode = exports.setTemporaryDebugMode = exports.DEBUG_CONFIG = void 0;
// Debug mode flags - set to false to disable specific log categories
exports.DEBUG_CONFIG = {
    // Screenshot-related logs (keep these ON for debugging)
    SCREENSHOT: true,
    SCREENSHOT_NATIVE: true,
    SCREENSHOT_DETECTION: true,
    SCREENSHOT_NOTIFICATIONS: true,
    // Chat and messaging logs (turn OFF to reduce noise)
    READ_RECEIPTS: false, // Was true, causing massive log spam
    CHAT: false, // Was true, causing polling logs
    REALTIME: false, // Supabase realtime connection logs
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
const setTemporaryDebugMode = (enabled) => {
    temporaryDebugMode = enabled;
};
exports.setTemporaryDebugMode = setTemporaryDebugMode;
const isTemporaryDebugMode = () => temporaryDebugMode;
exports.isTemporaryDebugMode = isTemporaryDebugMode;
// Helper functions for conditional logging
const debugLog = (category, message, ...args) => {
    if (exports.DEBUG_CONFIG[category] || temporaryDebugMode) {
        console.log(`[${category}] ${message}`, ...args);
    }
};
exports.debugLog = debugLog;
const debugWarn = (category, message, ...args) => {
    if (exports.DEBUG_CONFIG[category] || temporaryDebugMode) {
        console.warn(`[${category}] ${message}`, ...args);
    }
};
exports.debugWarn = debugWarn;
const debugError = (category, message, ...args) => {
    if (exports.DEBUG_CONFIG[category] || temporaryDebugMode) {
        console.error(`[${category}] ${message}`, ...args);
    }
};
exports.debugError = debugError;
// Screenshot-specific debug helpers (always enabled for debugging)
const screenshotLog = (message, ...args) => {
    if (exports.DEBUG_CONFIG.SCREENSHOT) {
        console.log(`[Screenshot] ${message}`, ...args);
    }
};
exports.screenshotLog = screenshotLog;
const screenshotWarn = (message, ...args) => {
    if (exports.DEBUG_CONFIG.SCREENSHOT) {
        console.warn(`[Screenshot] ${message}`, ...args);
    }
};
exports.screenshotWarn = screenshotWarn;
const screenshotError = (message, ...args) => {
    if (exports.DEBUG_CONFIG.SCREENSHOT) {
        console.error(`[Screenshot] ${message}`, ...args);
    }
};
exports.screenshotError = screenshotError;
// Quick toggle for testing
const enableAllDebugLogs = () => {
    Object.keys(exports.DEBUG_CONFIG).forEach(key => {
        exports.DEBUG_CONFIG[key] = true;
    });
    console.log('🔧 All debug logs enabled');
};
exports.enableAllDebugLogs = enableAllDebugLogs;
const disableNoisyLogs = () => {
    exports.DEBUG_CONFIG.READ_RECEIPTS = false;
    exports.DEBUG_CONFIG.CHAT = false;
    exports.DEBUG_CONFIG.REALTIME = false;
    exports.DEBUG_CONFIG.EPHEMERAL = false;
    console.log('🔇 Noisy logs disabled, screenshot logs remain active');
};
exports.disableNoisyLogs = disableNoisyLogs;
