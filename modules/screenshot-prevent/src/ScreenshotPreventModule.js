"use strict";
/**
 * Screenshot Prevention Native Module
 * Provides JavaScript interface to control Android FLAG_SECURE
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setScreenshotPrevention = exports.isScreenshotPreventionEnabled = exports.disableScreenshotPrevention = exports.enableScreenshotPrevention = void 0;
const react_native_1 = require("react-native");
// Platform-specific imports
let ScreenshotPreventModule;
if (react_native_1.Platform.OS === 'web') {
    ScreenshotPreventModule = require('./ScreenshotPreventModule.web').default;
}
else {
    ScreenshotPreventModule = require('./ScreenshotPreventModule.native').default;
}
exports.default = ScreenshotPreventModule;
// Export convenience functions
const enableScreenshotPrevention = async () => {
    try {
        return await ScreenshotPreventModule.enableSecure();
    }
    catch (error) {
        console.error('[ScreenshotPrevent] Failed to enable screenshot prevention:', error);
        return false;
    }
};
exports.enableScreenshotPrevention = enableScreenshotPrevention;
const disableScreenshotPrevention = async () => {
    try {
        return await ScreenshotPreventModule.disableSecure();
    }
    catch (error) {
        console.error('[ScreenshotPrevent] Failed to disable screenshot prevention:', error);
        return false;
    }
};
exports.disableScreenshotPrevention = disableScreenshotPrevention;
const isScreenshotPreventionEnabled = async () => {
    try {
        return await ScreenshotPreventModule.isSecureEnabled();
    }
    catch (error) {
        console.error('[ScreenshotPrevent] Failed to check screenshot prevention status:', error);
        return false;
    }
};
exports.isScreenshotPreventionEnabled = isScreenshotPreventionEnabled;
const setScreenshotPrevention = async (enabled) => {
    try {
        return await ScreenshotPreventModule.setSecureMode(enabled);
    }
    catch (error) {
        console.error('[ScreenshotPrevent] Failed to set screenshot prevention:', error);
        return false;
    }
};
exports.setScreenshotPrevention = setScreenshotPrevention;
//# sourceMappingURL=ScreenshotPreventModule.js.map