/**
 * Button component for WYD app
 * Follows the design system with proper touch targets and theming
 */

import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
  PressableProps,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  testID,
  ...pressableProps
}: ButtonProps) {
  const theme = useAppTheme();

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'small':
        return {
          container: {
            minHeight: theme.touchTargets.small,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
          text: theme.typography.button,
        };
      case 'large':
        return {
          container: {
            minHeight: theme.touchTargets.large,
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.lg,
          },
          text: theme.typography.buttonLarge,
        };
      default: // medium
        return {
          container: {
            minHeight: theme.touchTargets.medium,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
          },
          text: theme.typography.button,
        };
    }
  };

  const getVariantStyles = () => {
    const variantColors = theme.colors.button[variant];
    const isDisabled = disabled || loading;

    // Fallback to primary if variant doesn't exist
    if (!variantColors) {
      console.warn(`Button variant '${variant}' not found in theme, falling back to primary`);
      const fallbackColors = theme.colors.button.primary;
      return {
        container: {
          backgroundColor: isDisabled
            ? fallbackColors.disabled
            : fallbackColors.background,
        },
        text: {
          color: isDisabled
            ? fallbackColors.text
            : fallbackColors.text,
        },
        pressed: {
          backgroundColor: fallbackColors.pressed,
        },
      };
    }

    return {
      container: {
        backgroundColor: isDisabled
          ? variantColors.disabled
          : variantColors.background,
      },
      text: {
        color: isDisabled
          ? variant === 'tertiary' || variant === 'ghost'
            ? theme.colors.text.tertiary
            : variantColors.text
          : variantColors.text,
      },
      pressed: {
        backgroundColor: variantColors.pressed,
      },
    };
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  return (
    <Pressable
      {...pressableProps}
      testID={testID}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={typeof children === 'string' ? children : undefined}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.container,
        sizeStyles.container,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        style,
        {
          opacity: process.env.EXPO_PUBLIC_TESTING_MODE === 'true'
            ? 1
            : pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={variantStyles.text.color}
            size={size === 'small' ? 'small' : 'small'}
          />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <View style={styles.iconLeft}>{icon}</View>
            )}
            <Text style={[styles.text, sizeStyles.text, variantStyles.text]}>
              {children}
            </Text>
            {icon && iconPosition === 'right' && (
              <View style={styles.iconRight}>{icon}</View>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});