"use strict";
/**
 * Web implementation of ScreenshotPreventModule
 * Web browsers don't support screenshot prevention, so this is a stub implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    async enableSecure() {
        console.warn('[ScreenshotPrevent] Screenshot prevention is not supported on web');
        return false;
    },
    async disableSecure() {
        console.warn('[ScreenshotPrevent] Screenshot prevention is not supported on web');
        return false;
    },
    async isSecureEnabled() {
        return false;
    },
    async setSecureMode(enabled) {
        console.warn('[ScreenshotPrevent] Screenshot prevention is not supported on web');
        return false;
    },
};
//# sourceMappingURL=ScreenshotPreventModule.web.js.map