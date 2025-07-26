/**
 * Themed SafeAreaView component for WYD app
 * Automatically applies the theme background color
 */

import React from 'react';
import {
  SafeAreaView as RNSafeAreaView,
  SafeAreaViewProps,
  View,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

interface ThemedSafeAreaViewProps extends SafeAreaViewProps {
  backgroundColor?: string;
  edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
}

export function SafeAreaView({
  style,
  backgroundColor,
  children,
  ...props
}: ThemedSafeAreaViewProps) {
  const theme = useAppTheme();
  
  const bgColor = backgroundColor || theme.colors.background.primary;

  return (
    <RNSafeAreaView
      style={[
        { flex: 1, backgroundColor: bgColor },
        style,
      ]}
      {...props}
    >
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        {children}
      </View>
    </RNSafeAreaView>
  );
}