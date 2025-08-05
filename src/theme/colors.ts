/**
 * Color system for WYD app
 * Based on the style guide with purple accent (#6C63FF)
 */

// Base color palette - "Neon Nights" Theme
const palette = {
  // Primary - Electric Purple (upgraded from #6C63FF)
  purple50: '#F3F1FF',
  purple100: '#E9E4FF',
  purple200: '#D6CAFF',
  purple300: '#C1A8FF',
  purple400: '#AC80FF',
  purple500: '#B026FF', // NEW: Electric Purple (upgraded main accent)
  purple600: '#9D1FE6',
  purple700: '#8518CC',
  purple800: '#6B12A6',
  purple900: '#520E80',

  // Neon accent colors
  neonPink50: '#FFF1F8',
  neonPink100: '#FFE2F0',
  neonPink200: '#FFC6E1',
  neonPink300: '#FF9FCA',
  neonPink400: '#FF67AB',
  neonPink500: '#FF1B8D', // NEW: Neon Pink accent
  neonPink600: '#E6187F',
  neonPink700: '#CC1571',
  neonPink800: '#A6115C',
  neonPink900: '#800D47',

  // Cyber blue colors
  cyberBlue50: '#F0FDFF',
  cyberBlue100: '#E0FBFF',
  cyberBlue200: '#B8F5FF',
  cyberBlue300: '#85ECFF',
  cyberBlue400: '#42E0FF',
  cyberBlue500: '#00D9FF', // NEW: Cyber Blue accent
  cyberBlue600: '#00C3E6',
  cyberBlue700: '#00AECC',
  cyberBlue800: '#008FA6',
  cyberBlue900: '#006B80',

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
    accent: palette.purple500, // Updated to use new electric purple
    accentSecondary: palette.neonPink500, // NEW: Neon pink for highlights
    accentTertiary: palette.cyberBlue500, // NEW: Cyber blue for success states
    error: palette.red600,
    success: palette.green600,
    warning: palette.yellow600,
  },

  // Border colors
  border: {
    default: palette.gray200,
    focus: palette.purple500, // Uses new electric purple
    error: palette.red500,
    subtle: palette.gray100,
  },

  // Component specific
  button: {
    primary: {
      background: palette.purple500, // Uses new electric purple
      text: palette.white,
      pressed: palette.purple600, // Uses updated darker purple
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
      text: palette.purple500, // Uses new electric purple
      pressed: palette.purple50,
      disabled: palette.gray300,
    },
    ghost: {
      background: palette.transparent,
      text: palette.purple500, // Uses new electric purple
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
    sent: palette.purple500, // Uses new electric purple
    received: palette.gray100,
    sentText: palette.white,
    receivedText: palette.gray900,
  },
  
  // Ephemeral effects (light theme versions) - Enhanced with neon colors
  ephemeral: {
    glow: palette.purple300, // Uses new purple palette
    glowIntense: palette.purple500, // Uses new electric purple
    neonPinkGlow: palette.neonPink300, // NEW: Neon pink glow
    cyberBlueGlow: palette.cyberBlue300, // NEW: Cyber blue glow
    countdown: palette.cyberBlue500, // Uses cyber blue for countdown
    warning: palette.yellow500,
    danger: palette.red500,
  },
};

// Dark mysterious palette for VanishVoice - "Neon Nights" Dark Theme
const darkPalette = {
  // Deep blacks with slight tint
  black900: '#0A0A0F',  // Almost black with blue tint
  black800: '#12121A',  // Slightly lighter
  black700: '#1A1A24',  // Card backgrounds
  black600: '#22222E',  // Elevated surfaces
  
  // Electric purples for accent and glow (updated)
  purple300: '#C1A8FF',  // Light purple for glow
  purple400: '#AC80FF',  // Medium purple
  purple500: '#B026FF',  // NEW: Electric purple (main accent)
  purple600: '#9D1FE6',  // Slightly darker
  purple700: '#8518CC',  // Dark purple
  
  // Neon accents for dark theme
  neonPink400: '#FF67AB', // Neon pink for highlights
  neonPink500: '#FF1B8D', // Full intensity neon pink
  cyberBlue400: '#42E0FF', // Cyber blue for accents
  cyberBlue500: '#00D9FF', // Full intensity cyber blue
  
  // Mysterious teals (now used as secondary accents)
  teal400: '#2DD4BF',
  teal500: '#14B8A6',
  teal600: '#0D9488',
};

// Semantic color tokens for dark theme
export const darkColors = {
  // Background colors - darker and more mysterious
  background: {
    primary: darkPalette.black900,
    secondary: darkPalette.black800,
    tertiary: darkPalette.black700,
    elevated: darkPalette.black600,
    overlay: 'rgba(0, 0, 0, 0.85)',
  },

  // Text colors - Enhanced with neon accents
  text: {
    primary: palette.gray50,
    secondary: palette.gray300,
    tertiary: palette.gray400,
    disabled: palette.gray500,
    inverse: palette.gray900,
    accent: darkPalette.purple500, // NEW: Electric purple accent
    accentSecondary: darkPalette.neonPink500, // NEW: Neon pink for highlights
    accentTertiary: darkPalette.cyberBlue500, // NEW: Cyber blue for success states
    error: palette.red500,
    success: palette.green500,
    warning: palette.yellow500,
  },

  // Border colors
  border: {
    default: palette.gray700,
    focus: darkPalette.purple500, // Uses new electric purple
    error: palette.red500,
    subtle: palette.gray800,
  },

  // Component specific
  button: {
    primary: {
      background: darkPalette.purple500, // Uses new electric purple
      text: palette.white,
      pressed: darkPalette.purple400, // Lighter on press for dark theme
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
      text: darkPalette.purple500, // Uses new electric purple
      pressed: 'rgba(176, 38, 255, 0.1)', // Updated pressed color for new purple
      disabled: palette.gray600,
    },
    ghost: {
      background: palette.transparent,
      text: darkPalette.purple500, // Uses new electric purple
      pressed: 'rgba(176, 38, 255, 0.1)', // Updated pressed color for new purple
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
    sent: darkPalette.purple500, // Uses new electric purple
    received: darkPalette.black700,
    sentText: palette.white,
    receivedText: palette.gray50,
  },
  
  // Ephemeral effects - Enhanced with neon colors
  ephemeral: {
    glow: darkPalette.purple400, // Uses new purple palette
    glowIntense: darkPalette.purple500, // Uses new electric purple
    neonPinkGlow: darkPalette.neonPink400, // NEW: Neon pink glow for dark theme
    cyberBlueGlow: darkPalette.cyberBlue400, // NEW: Cyber blue glow for dark theme
    countdown: darkPalette.cyberBlue500, // Uses cyber blue for countdown
    warning: palette.yellow500,
    danger: palette.red500,
  },
};

// Neon colors object that can be accessed via theme.colors.neon
export const neonColors = {
  electricPurple: '#B026FF',
  neonPink: '#FF1B8D', 
  cyberBlue: '#00D9FF',
  matrixGreen: '#39FF14', // Adding matrix green for completeness
} as const;

// Add neon to light colors
export const lightColorsWithNeon = {
  ...lightColors,
  neon: neonColors,
};

// Add neon to dark colors  
export const darkColorsWithNeon = {
  ...darkColors,
  neon: neonColors,
};

export type Colors = typeof lightColorsWithNeon;

// Export the new neon color constants for direct use
export const NEON_COLORS = {
  ELECTRIC_PURPLE: '#B026FF',
  NEON_PINK: '#FF1B8D', 
  CYBER_BLUE: '#00D9FF',
} as const;