/**
 * Native implementation of ScreenshotPreventModule
 * This will be resolved on iOS and Android platforms
 */

import { Platform } from 'react-native';
import { IScreenshotPreventModule } from './ScreenshotPreventModule';

// Create robust implementation that handles module loading failures
const ScreenshotPreventModule: IScreenshotPreventModule = {
  async enableSecure(): Promise<boolean> {
    try {
      // Try to load the native module dynamically
      const { requireNativeModule } = require('expo-modules-core');
      const NativeScreenshotPrevent = requireNativeModule('ScreenshotPrevent');
      return await NativeScreenshotPrevent.enableSecure();
    } catch (error) {
      console.error('[ScreenshotPrevent Native] enableSecure failed - module not available:', error instanceof Error ? error.message : String(error));
      // Return false but don't crash the app
      return false;
    }
  },

  async disableSecure(): Promise<boolean> {
    try {
      const { requireNativeModule } = require('expo-modules-core');
      const NativeScreenshotPrevent = requireNativeModule('ScreenshotPrevent');
      return await NativeScreenshotPrevent.disableSecure();
    } catch (error) {
      console.error('[ScreenshotPrevent Native] disableSecure failed - module not available:', error instanceof Error ? error.message : String(error));
      return false;
    }
  },

  async isSecureEnabled(): Promise<boolean> {
    try {
      const { requireNativeModule } = require('expo-modules-core');
      const NativeScreenshotPrevent = requireNativeModule('ScreenshotPrevent');
      return await NativeScreenshotPrevent.isSecureEnabled();
    } catch (error) {
      console.error('[ScreenshotPrevent Native] isSecureEnabled failed - module not available:', error instanceof Error ? error.message : String(error));
      return false;
    }
  },

  async setSecureMode(enabled: boolean): Promise<boolean> {
    try {
      const { requireNativeModule } = require('expo-modules-core');
      const NativeScreenshotPrevent = requireNativeModule('ScreenshotPrevent');
      return await NativeScreenshotPrevent.setSecureMode(enabled);
    } catch (error) {
      console.error('[ScreenshotPrevent Native] setSecureMode failed - module not available:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }
};

export default ScreenshotPreventModule;