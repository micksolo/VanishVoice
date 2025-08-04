/**
 * Expo Go Compatibility Layer
 * 
 * This module provides compatibility shims for native modules that don't work in Expo Go.
 * It detects the runtime environment and provides fallback implementations.
 */

import Constants from 'expo-constants';

/**
 * Detect if running in Expo Go client
 */
export const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Mock implementation of react-native-compressor for Expo Go
 */
const mockCompressor = {
  Video: {
    async compress(
      uri: string,
      options: any,
      onProgress?: (progress: number) => void
    ): Promise<string> {
      console.warn('🚧 Video compression not available in Expo Go - returning original video');
      
      // Simulate compression progress for UI testing
      if (onProgress) {
        for (let i = 0; i <= 100; i += 10) {
          setTimeout(() => onProgress(i / 100), i * 50);
        }
      }
      
      // Return original URI since we can't actually compress
      return uri;
    }
  }
};

/**
 * Conditionally import react-native-compressor or use mock
 */
export const getCompressor = async () => {
  if (isExpoGo) {
    console.warn('📱 Running in Expo Go - using mock video compressor');
    return mockCompressor;
  }
  
  try {
    // Dynamic import to avoid bundling issues in Expo Go
    const compressor = await import('react-native-compressor');
    return compressor;
  } catch (error) {
    console.warn('⚠️  react-native-compressor not available, using mock implementation');
    return mockCompressor;
  }
};

/**
 * Warning helper for features that require development build
 */
export const requiresDevelopmentBuild = (featureName: string) => {
  if (isExpoGo) {
    console.warn(`🚧 ${featureName} requires a development build and won't work in Expo Go`);
    return true;
  }
  return false;
};

/**
 * Show user-friendly message for features not available in Expo Go
 */
export const getExpoGoLimitationMessage = (feature: string): string => {
  return `${feature} requires a development build. Please use:\n\n` +
         `• iOS Simulator: npm run build:dev:ios\n` +
         `• Android Emulator: npm run build:dev:android\n` +
         `• Physical Device: npm run build:dev:device\n\n` +
         `Or test other features that work in Expo Go.`;
};

/**
 * Known compatibility issues and their status
 */
export const compatibilityInfo = {
  warnings: {
    'use-latest-callback': {
      description: 'Package export warnings from React Navigation dependencies',
      severity: 'low',
      impact: 'None - app functions normally',
      action: 'No action needed - third-party package issue'
    },
    'expo-notifications': {
      description: 'expo-notifications removed from Expo Go in SDK 53',
      severity: 'medium',
      impact: 'Push notifications not available in Expo Go',
      action: 'Use development build for push notification testing'
    },
    'expo-av': {
      description: 'expo-av will be deprecated in SDK 54',
      severity: 'medium',
      impact: 'Audio/video features will need migration in future',
      action: 'Plan migration to alternative libraries before SDK 54'
    }
  },
  errors: {
    'react-native-compressor': {
      description: 'Native module not available in Expo Go',
      severity: 'high',
      impact: 'Video compression falls back to no compression',
      action: 'Fixed with conditional loading - now working in Expo Go'
    }
  }
};