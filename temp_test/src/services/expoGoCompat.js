"use strict";
/**
 * Expo Go Compatibility Layer
 *
 * This module provides compatibility shims for native modules that don't work in Expo Go.
 * It detects the runtime environment and provides fallback implementations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compatibilityInfo = exports.getExpoGoLimitationMessage = exports.requiresDevelopmentBuild = exports.getCompressor = exports.isExpoGo = void 0;
const expo_constants_1 = __importDefault(require("expo-constants"));
/**
 * Detect if running in Expo Go client
 */
exports.isExpoGo = expo_constants_1.default.appOwnership === 'expo';
/**
 * Mock implementation of react-native-compressor for Expo Go
 */
const mockCompressor = {
    Video: {
        async compress(uri, options, onProgress) {
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
const getCompressor = async () => {
    if (exports.isExpoGo) {
        console.warn('📱 Running in Expo Go - using mock video compressor');
        return mockCompressor;
    }
    try {
        // Dynamic import to avoid bundling issues in Expo Go
        const compressor = await Promise.resolve().then(() => __importStar(require('react-native-compressor')));
        return compressor;
    }
    catch (error) {
        console.warn('⚠️  react-native-compressor not available, using mock implementation');
        return mockCompressor;
    }
};
exports.getCompressor = getCompressor;
/**
 * Warning helper for features that require development build
 */
const requiresDevelopmentBuild = (featureName) => {
    if (exports.isExpoGo) {
        console.warn(`🚧 ${featureName} requires a development build and won't work in Expo Go`);
        return true;
    }
    return false;
};
exports.requiresDevelopmentBuild = requiresDevelopmentBuild;
/**
 * Show user-friendly message for features not available in Expo Go
 */
const getExpoGoLimitationMessage = (feature) => {
    return `${feature} requires a development build. Please use:\n\n` +
        `• iOS Simulator: npm run build:dev:ios\n` +
        `• Android Emulator: npm run build:dev:android\n` +
        `• Physical Device: npm run build:dev:device\n\n` +
        `Or test other features that work in Expo Go.`;
};
exports.getExpoGoLimitationMessage = getExpoGoLimitationMessage;
/**
 * Known compatibility issues and their status
 */
exports.compatibilityInfo = {
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
