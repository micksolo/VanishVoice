/**
 * Web implementation of ScreenshotPreventModule
 * Web browsers don't support screenshot prevention, so this is a stub implementation
 */

export default {
  async enableSecure(): Promise<boolean> {
    console.warn('[ScreenshotPrevent] Screenshot prevention is not supported on web');
    return false;
  },

  async disableSecure(): Promise<boolean> {
    console.warn('[ScreenshotPrevent] Screenshot prevention is not supported on web');
    return false;
  },

  async isSecureEnabled(): Promise<boolean> {
    return false;
  },

  async setSecureMode(enabled: boolean): Promise<boolean> {
    console.warn('[ScreenshotPrevent] Screenshot prevention is not supported on web');
    return false;
  },
};