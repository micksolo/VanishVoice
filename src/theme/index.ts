/**
 * Main theme file for WYD app
 * Exports the complete theme object with all design tokens
 */

import { lightColors, darkColors, Colors } from './colors';
import { typography, Typography } from './typography';
import { spacing, layout, touchTargets, Spacing } from './spacing';

// Border radius values
export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// Shadow definitions
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

// Animation durations
export const animations = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Theme object structure
export interface Theme {
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
  layout: typeof layout;
  touchTargets: typeof touchTargets;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  animations: typeof animations;
  isDark: boolean;
}

// Light theme
export const lightTheme: Theme = {
  colors: lightColors,
  typography,
  spacing,
  layout,
  touchTargets,
  borderRadius,
  shadows,
  animations,
  isDark: false,
};

// Dark theme
export const darkTheme: Theme = {
  colors: darkColors,
  typography,
  spacing,
  layout,
  touchTargets,
  borderRadius,
  shadows,
  animations,
  isDark: true,
};

// Re-export individual modules
export { lightColors, darkColors, typography, spacing, layout, touchTargets };
export type { Colors, Typography, Spacing };