/**
 * Theme selector component for WYD app
 * Allows users to switch between light, dark, and system themes
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useAppTheme } from '../contexts/ThemeContext';
import { Card } from './ui';
import { Button } from './ui';

export function ThemeSelector() {
  const { themeMode, setThemeMode } = useTheme();
  const theme = useAppTheme();

  const themeModes = [
    { value: 'light' as const, label: 'Light', icon: 'sunny-outline' as const },
    { value: 'dark' as const, label: 'Dark', icon: 'moon-outline' as const },
    { value: 'system' as const, label: 'System', icon: 'phone-portrait-outline' as const },
  ];

  return (
    <Card elevation="small" style={styles.container}>
      <Text style={[styles.title, theme.typography.headlineSmall, { color: theme.colors.text.primary }]}>
        Theme
      </Text>
      <View style={styles.options}>
        {themeModes.map((mode) => (
          <Button
            key={mode.value}
            variant={themeMode === mode.value ? 'primary' : 'secondary'}
            size="small"
            onPress={() => setThemeMode(mode.value)}
            icon={
              <Ionicons
                name={mode.icon}
                size={20}
                color={
                  themeMode === mode.value
                    ? theme.colors.button.primary.text
                    : theme.colors.text.primary
                }
              />
            }
            style={styles.themeButton}
          >
            {mode.label}
          </Button>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    marginBottom: 12,
  },
  options: {
    flexDirection: 'row',
    gap: 12,
  },
  themeButton: {
    flex: 1,
  },
});