/**
 * Spacing system for WYD app
 * Based on 4px grid system
 */

export const spacing = {
  xs: 4,    // 4px
  sm: 8,    // 8px
  md: 12,   // 12px
  lg: 16,   // 16px
  xl: 24,   // 24px
  xxl: 32,  // 32px
  xxxl: 48, // 48px
} as const;

// Layout specific spacing
export const layout = {
  screenPadding: spacing.lg,
  cardPadding: spacing.lg,
  sectionSpacing: spacing.xl,
  componentSpacing: spacing.md,
} as const;

// Touch target minimum sizes (44x44pt as per guidelines)
export const touchTargets = {
  minimum: 44,
  small: 44,
  medium: 48,
  large: 56,
} as const;

export type Spacing = typeof spacing;