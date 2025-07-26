/**
 * Typography system for WYD app
 * Standardized sizes from 12-32px with consistent line heights
 */

import { Platform } from 'react-native';

// Font families
export const fontFamilies = {
  regular: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
    default: 'System',
  }),
  semibold: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
    default: 'System',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'Roboto-Bold',
    default: 'System',
  }),
};

// Font weights for iOS (uses System font weight variants)
export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Typography scale
export const typography = {
  // Display
  displayLarge: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: fontFamilies.bold,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontSize: 28,
    lineHeight: 36,
    fontFamily: fontFamilies.bold,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.25,
  },
  displaySmall: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: fontFamilies.semibold,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0,
  },

  // Headline
  headlineLarge: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: fontFamilies.semibold,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fontFamilies.semibold,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0,
  },
  headlineSmall: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: fontFamilies.semibold,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0,
  },

  // Body
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fontFamilies.regular,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.15,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamilies.regular,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.25,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamilies.regular,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.4,
  },

  // Label
  labelLarge: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamilies.medium,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamilies.medium,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fontFamilies.medium,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.5,
  },

  // Button
  button: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamilies.semibold,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
    textTransform: 'none' as const,
  },
  buttonLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fontFamilies.semibold,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.5,
    textTransform: 'none' as const,
  },

  // Caption
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamilies.regular,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.4,
  },

  // Overline
  overline: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: fontFamilies.medium,
    fontWeight: fontWeights.medium,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
};

export type Typography = typeof typography;