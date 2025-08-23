"use strict";
/**
 * Native implementation of ScreenshotPreventModule
 * This will be resolved on iOS and Android platforms
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Create robust implementation that handles module loading failures
const ScreenshotPreventModule = {
    async enableSecure() {
        try {
            // Try to load the native module dynamically
            const { requireNativeModule } = require('expo-modules-core');
            const NativeScreenshotPrevent = requireNativeModule('ScreenshotPrevent');
            return await NativeScreenshotPrevent.enableSecure();
        }
        catch (error) {
            console.error('[ScreenshotPrevent Native] enableSecure failed - module not available:', error instanceof Error ? error.message : String(error));
            // Return false but don't crash the app
            return false;
        }
    },
    async disableSecure() {
        try {
            const { requireNativeModule } = require('expo-modules-core');
            const NativeScreenshotPrevent = requireNativeModule('ScreenshotPrevent');
            return await NativeScreenshotPrevent.disableSecure();
        }
        catch (error) {
            console.error('[ScreenshotPrevent Native] disableSecure failed - module not available:', error instanceof Error ? error.message : String(error));
            return false;
        }
    },
    async isSecureEnabled() {
        try {
            const { requireNativeModule } = require('expo-modules-core');
            const NativeScreenshotPrevent = requireNativeModule('ScreenshotPrevent');
            return await NativeScreenshotPrevent.isSecureEnabled();
        }
        catch (error) {
            console.error('[ScreenshotPrevent Native] isSecureEnabled failed - module not available:', error instanceof Error ? error.message : String(error));
            return false;
        }
    },
    async setSecureMode(enabled) {
        try {
            const { requireNativeModule } = require('expo-modules-core');
            const NativeScreenshotPrevent = requireNativeModule('ScreenshotPrevent');
            return await NativeScreenshotPrevent.setSecureMode(enabled);
        }
        catch (error) {
            console.error('[ScreenshotPrevent Native] setSecureMode failed - module not available:', error instanceof Error ? error.message : String(error));
            return false;
        }
    }
};
exports.default = ScreenshotPreventModule;
//# sourceMappingURL=ScreenshotPreventModule.native.js.map