/**
 * Header component for WYD app
 * Provides consistent header styling with back button support
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { IconButton } from './IconButton';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
  transparent?: boolean;
}

export function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  style,
  transparent = false,
}: HeaderProps) {
  const theme = useAppTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const statusBarHeight = Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0;
  const topPadding = Math.max(insets.top, statusBarHeight);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPadding + theme.spacing.sm,
          backgroundColor: transparent
            ? 'transparent'
            : theme.colors.background.primary,
          borderBottomColor: theme.colors.border.subtle,
        },
        !transparent && styles.bordered,
        style,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          {showBack && (
            <IconButton
              icon={
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={theme.colors.text.primary}
                />
              }
              onPress={handleBack}
              size="medium"
              variant="ghost"
            />
          )}
        </View>

        <View style={styles.centerSection}>
          <Text
            style={[
              styles.title,
              theme.typography.headlineMedium,
              { color: theme.colors.text.primary },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                theme.typography.bodySmall,
                { color: theme.colors.text.secondary },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightSection}>
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
  },
  bordered: {
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  leftSection: {
    width: 48,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 48,
    alignItems: 'flex-end',
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 2,
  },
});