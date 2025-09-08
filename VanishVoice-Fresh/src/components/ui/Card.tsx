/**
 * Card component for WYD app
 * Follows the design system with proper theming and shadows
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ViewProps,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

type CardElevation = 'none' | 'small' | 'medium' | 'large';

interface BaseCardProps {
  children: React.ReactNode;
  elevation?: CardElevation;
  padding?: boolean;
  borderRadius?: number;
}

interface StaticCardProps extends BaseCardProps, ViewProps {
  pressable?: false;
}

interface PressableCardProps extends BaseCardProps, TouchableOpacityProps {
  pressable: true;
}

type CardProps = StaticCardProps | PressableCardProps;

export function Card(props: CardProps) {
  const theme = useAppTheme();
  const {
    children,
    elevation = 'small',
    padding = true,
    borderRadius = theme.borderRadius.md,
    style,
    ...restProps
  } = props;

  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.colors.background.elevated,
      borderRadius,
    },
    padding && { padding: theme.layout.cardPadding },
    elevation !== 'none' && theme.shadows[elevation],
    style,
  ];

  if (props.pressable) {
    const { pressable, ...touchableProps } = restProps as PressableCardProps;
    return (
      <TouchableOpacity
        {...touchableProps}
        style={cardStyle}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }

  const viewProps = restProps as ViewProps;
  return (
    <View {...viewProps} style={cardStyle}>
      {children}
    </View>
  );
}

// Section variant for grouping content
interface CardSectionProps extends ViewProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  divider?: boolean;
}

export function CardSection({
  children,
  title,
  divider = false,
  style,
  ...viewProps
}: CardSectionProps) {
  const theme = useAppTheme();

  return (
    <View
      {...viewProps}
      style={[
        styles.section,
        divider && {
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.subtle,
          paddingTop: theme.spacing.md,
          marginTop: theme.spacing.md,
        },
        style,
      ]}
    >
      {title}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  section: {
    // Base section styles
  },
});