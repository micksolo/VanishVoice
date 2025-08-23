/**
 * Screenshot Prevention Native Module
 * Provides JavaScript interface to control Android FLAG_SECURE
 */

import { Platform } from 'react-native';

// Define the interface for our native module
export interface IScreenshotPreventModule {
  enableSecure(): Promise<boolean>;
  disableSecure(): Promise<boolean>;
  isSecureEnabled(): Promise<boolean>;
  setSecureMode(enabled: boolean): Promise<boolean>;
}

// Platform-specific imports
let ScreenshotPreventModule: IScreenshotPreventModule;

if (Platform.OS === 'web') {
  ScreenshotPreventModule = require('./ScreenshotPreventModule.web').default;
} else {
  ScreenshotPreventModule = require('./ScreenshotPreventModule.native').default;
}

export default ScreenshotPreventModule;

// Export convenience functions
export const enableScreenshotPrevention = async (): Promise<boolean> => {
  try {
    return await ScreenshotPreventModule.enableSecure();
  } catch (error) {
    console.error('[ScreenshotPrevent] Failed to enable screenshot prevention:', error);
    return false;
  }
};

export const disableScreenshotPrevention = async (): Promise<boolean> => {
  try {
    return await ScreenshotPreventModule.disableSecure();
  } catch (error) {
    console.error('[ScreenshotPrevent] Failed to disable screenshot prevention:', error);
    return false;
  }
};

export const isScreenshotPreventionEnabled = async (): Promise<boolean> => {
  try {
    return await ScreenshotPreventModule.isSecureEnabled();
  } catch (error) {
    console.error('[ScreenshotPrevent] Failed to check screenshot prevention status:', error);
    return false;
  }
};

export const setScreenshotPrevention = async (enabled: boolean): Promise<boolean> => {
  try {
    return await ScreenshotPreventModule.setSecureMode(enabled);
  } catch (error) {
    console.error('[ScreenshotPrevent] Failed to set screenshot prevention:', error);
    return false;
  }
};