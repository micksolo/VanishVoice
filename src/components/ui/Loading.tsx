/**
 * Loading component for WYD app
 * Provides consistent loading states throughout the app
 */

import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

interface LoadingProps {
  size?: 'small' | 'large';
  text?: string;
  fullScreen?: boolean;
  color?: string;
  style?: ViewStyle;
}

export function Loading({
  size = 'large',
  text,
  fullScreen = false,
  color,
  style,
}: LoadingProps) {
  const theme = useAppTheme();

  const content = (
    <View style={[styles.container, style]}>
      <ActivityIndicator
        size={size}
        color={color || theme.colors.button.primary.background}
      />
      {text && (
        <Text
          style={[
            styles.text,
            theme.typography.bodyMedium,
            { color: theme.colors.text.secondary },
          ]}
        >
          {text}
        </Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View
        style={[
          styles.fullScreen,
          { backgroundColor: theme.colors.background.primary },
        ]}
      >
        {content}
      </View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 12,
    textAlign: 'center',
  },
});