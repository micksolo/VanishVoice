/**
 * Input component for WYD app
 * Follows the design system with proper theming and accessibility
 */

import React, { useState, forwardRef } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerStyle,
      inputStyle,
      editable = true,
      ...textInputProps
    },
    ref
  ) => {
    const theme = useAppTheme();
    const [isFocused, setIsFocused] = useState(false);

    const hasError = !!error;
    const isDisabled = !editable;

    const getBorderColor = () => {
      if (hasError) return theme.colors.border.error;
      if (isFocused) return theme.colors.border.focus;
      return theme.colors.border.default;
    };

    const getBackgroundColor = () => {
      if (isDisabled) return theme.colors.background.tertiary;
      return theme.colors.background.primary;
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text
            style={[
              styles.label,
              theme.typography.labelMedium,
              { color: theme.colors.text.secondary },
            ]}
          >
            {label}
          </Text>
        )}

        <View
          style={[
            styles.inputContainer,
            {
              borderColor: getBorderColor(),
              backgroundColor: getBackgroundColor(),
            },
          ]}
        >
          {leftIcon && (
            <View style={[styles.iconContainer, styles.leftIcon]}>
              {leftIcon}
            </View>
          )}

          <TextInput
            ref={ref}
            {...textInputProps}
            editable={editable}
            style={[
              styles.input,
              theme.typography.bodyMedium,
              {
                color: isDisabled
                  ? theme.colors.text.tertiary
                  : theme.colors.text.primary,
              },
              leftIcon && styles.inputWithLeftIcon,
              rightIcon && styles.inputWithRightIcon,
              inputStyle,
            ]}
            placeholderTextColor={theme.colors.text.tertiary}
            onFocus={(e) => {
              setIsFocused(true);
              textInputProps.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              textInputProps.onBlur?.(e);
            }}
          />

          {rightIcon && (
            <TouchableOpacity
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
              style={[styles.iconContainer, styles.rightIcon]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {rightIcon}
            </TouchableOpacity>
          )}
        </View>

        {(error || helperText) && (
          <Text
            style={[
              styles.helperText,
              theme.typography.caption,
              {
                color: hasError
                  ? theme.colors.text.error
                  : theme.colors.text.secondary,
              },
            ]}
          >
            {error || helperText}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48, // Ensures minimum touch target
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44, // Minimum touch target
    minHeight: 44,
  },
  leftIcon: {
    marginLeft: 4,
  },
  rightIcon: {
    marginRight: 4,
  },
  helperText: {
    marginTop: 4,
  },
});