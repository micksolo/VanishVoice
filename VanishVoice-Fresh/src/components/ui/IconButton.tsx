/**
 * IconButton component for WYD app
 * Ensures proper touch targets for icon-only buttons
 */

import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  StyleSheet,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

interface IconButtonProps extends TouchableOpacityProps {
  icon: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  variant?: 'ghost' | 'filled' | 'outlined';
  color?: string;
}

export function IconButton({
  icon,
  size = 'medium',
  variant = 'ghost',
  color,
  style,
  disabled,
  ...touchableProps
}: IconButtonProps) {
  const theme = useAppTheme();

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: {
            width: theme.touchTargets.small,
            height: theme.touchTargets.small,
          },
        };
      case 'large':
        return {
          container: {
            width: theme.touchTargets.large,
            height: theme.touchTargets.large,
          },
        };
      default: // medium
        return {
          container: {
            width: theme.touchTargets.medium,
            height: theme.touchTargets.medium,
          },
        };
    }
  };

  const getVariantStyles = () => {
    const isDisabled = disabled;
    
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: isDisabled
            ? theme.colors.button.primary.disabled
            : color || theme.colors.button.primary.background,
        };
      case 'outlined':
        return {
          borderWidth: 1,
          borderColor: isDisabled
            ? theme.colors.border.subtle
            : color || theme.colors.border.default,
        };
      default: // ghost
        return {
          backgroundColor: 'transparent',
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  return (
    <TouchableOpacity
      {...touchableProps}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.container,
        sizeStyles.container,
        variantStyles,
        style,
      ]}
    >
      <View style={styles.iconContainer}>
        {icon}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});