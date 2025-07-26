/**
 * Color system for WYD app
 * Based on the style guide with purple accent (#6C63FF)
 */

// Base color palette
const palette = {
  // Primary - Purple accent
  purple50: '#F3F2FF',
  purple100: '#E9E7FF',
  purple200: '#D4D0FF',
  purple300: '#B8B2FF',
  purple400: '#9A91FF',
  purple500: '#6C63FF', // Main accent
  purple600: '#5A51E6',
  purple700: '#4940CC',
  purple800: '#3A32A6',
  purple900: '#2B2580',

  // Neutrals
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#E5E5E5',
  gray300: '#D4D4D4',
  gray400: '#A3A3A3',
  gray500: '#737373',
  gray600: '#525252',
  gray700: '#404040',
  gray800: '#262626',
  gray900: '#171717',

  // System colors
  red500: '#EF4444',
  red600: '#DC2626',
  red700: '#B91C1C',
  green500: '#10B981',
  green600: '#059669',
  green700: '#047857',
  yellow500: '#F59E0B',
  yellow600: '#D97706',
  blue500: '#3B82F6',
  blue600: '#2563EB',

  // Pure values
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// Semantic color tokens for light theme
export const lightColors = {
  // Background colors
  background: {
    primary: palette.white,
    secondary: palette.gray50,
    tertiary: palette.gray100,
    elevated: palette.white,
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Text colors
  text: {
    primary: palette.gray900,
    secondary: palette.gray600,
    tertiary: palette.gray500,
    disabled: palette.gray400,
    inverse: palette.white,
    accent: palette.purple600,
    error: palette.red600,
    success: palette.green600,
    warning: palette.yellow600,
  },

  // Border colors
  border: {
    default: palette.gray200,
    focus: palette.purple500,
    error: palette.red500,
    subtle: palette.gray100,
  },

  // Component specific
  button: {
    primary: {
      background: palette.purple500,
      text: palette.white,
      pressed: palette.purple600,
      disabled: palette.purple200,
    },
    secondary: {
      background: palette.gray100,
      text: palette.gray900,
      pressed: palette.gray200,
      disabled: palette.gray50,
    },
    tertiary: {
      background: palette.transparent,
      text: palette.purple600,
      pressed: palette.purple50,
      disabled: palette.gray300,
    },
    ghost: {
      background: palette.transparent,
      text: palette.purple600,
      pressed: palette.purple50,
      disabled: palette.gray300,
    },
    danger: {
      background: palette.red500,
      text: palette.white,
      pressed: palette.red600,
      disabled: palette.red200,
    },
  },

  // Status colors
  status: {
    success: palette.green500,
    warning: palette.yellow500,
    error: palette.red500,
    info: palette.blue500,
  },

  // Shadow
  shadow: {
    small: 'rgba(0, 0, 0, 0.04)',
    medium: 'rgba(0, 0, 0, 0.08)',
    large: 'rgba(0, 0, 0, 0.12)',
  },

  // Recording specific
  recording: {
    active: palette.red500,
    inactive: palette.gray400,
    pulse: palette.red500,
  },

  // Chat specific
  chat: {
    sent: palette.purple500,
    received: palette.gray100,
    sentText: palette.white,
    receivedText: palette.gray900,
  },
};

// Semantic color tokens for dark theme
export const darkColors = {
  // Background colors
  background: {
    primary: palette.gray900,
    secondary: palette.gray800,
    tertiary: palette.gray700,
    elevated: palette.gray800,
    overlay: 'rgba(0, 0, 0, 0.7)',
  },

  // Text colors
  text: {
    primary: palette.gray50,
    secondary: palette.gray300,
    tertiary: palette.gray400,
    disabled: palette.gray500,
    inverse: palette.gray900,
    accent: palette.purple400,
    error: palette.red500,
    success: palette.green500,
    warning: palette.yellow500,
  },

  // Border colors
  border: {
    default: palette.gray700,
    focus: palette.purple400,
    error: palette.red500,
    subtle: palette.gray800,
  },

  // Component specific
  button: {
    primary: {
      background: palette.purple500,
      text: palette.white,
      pressed: palette.purple400,
      disabled: palette.purple900,
    },
    secondary: {
      background: palette.gray700,
      text: palette.gray50,
      pressed: palette.gray600,
      disabled: palette.gray800,
    },
    tertiary: {
      background: palette.transparent,
      text: palette.purple400,
      pressed: 'rgba(108, 99, 255, 0.1)',
      disabled: palette.gray600,
    },
    ghost: {
      background: palette.transparent,
      text: palette.purple400,
      pressed: 'rgba(108, 99, 255, 0.1)',
      disabled: palette.gray600,
    },
    danger: {
      background: palette.red600,
      text: palette.white,
      pressed: palette.red500,
      disabled: palette.red900,
    },
  },

  // Status colors
  status: {
    success: palette.green500,
    warning: palette.yellow500,
    error: palette.red500,
    info: palette.blue500,
  },

  // Shadow
  shadow: {
    small: 'rgba(0, 0, 0, 0.2)',
    medium: 'rgba(0, 0, 0, 0.3)',
    large: 'rgba(0, 0, 0, 0.4)',
  },

  // Recording specific
  recording: {
    active: palette.red500,
    inactive: palette.gray500,
    pulse: palette.red500,
  },

  // Chat specific
  chat: {
    sent: palette.purple500,
    received: palette.gray700,
    sentText: palette.white,
    receivedText: palette.gray50,
  },
};

export type Colors = typeof lightColors;