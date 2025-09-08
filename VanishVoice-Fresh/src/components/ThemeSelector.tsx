/**
 * Theme selector component for WYD app
 * Allows users to switch between light, dark, and system themes
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useAppTheme } from '../contexts/ThemeContext';
import { Card } from './ui';
import { Button } from './ui';

export function ThemeSelector() {
  const { themeMode, setThemeMode } = useTheme();
  const theme = useAppTheme();
  const [pendingTheme, setPendingTheme] = useState<string | null>(null);

  const themeModes = [
    { value: 'light' as const, label: 'Light', icon: 'sunny-outline' as const },
    { value: 'dark' as const, label: 'Dark', icon: 'moon-outline' as const },
    { value: 'system' as const, label: 'System', icon: 'phone-portrait-outline' as const },
  ];

  const handleThemeChange = async (mode: 'light' | 'dark' | 'system') => {
    // Show immediate visual feedback
    setPendingTheme(mode);
    
    try {
      // Apply the theme change
      await setThemeMode(mode);
    } catch (error) {
      console.error('Failed to change theme:', error);
    } finally {
      // Clear pending state
      setPendingTheme(null);
    }
  };

  // Use pending theme for immediate visual feedback, fall back to actual theme mode
  const displayedTheme = pendingTheme || themeMode;

  return (
    <Card elevation="small" style={styles.container}>
      <Text style={[styles.title, theme.typography.headlineSmall, { color: theme.colors.text.primary }]}>
        Theme
      </Text>
      <View style={styles.options}>
        {themeModes.map((mode) => {
          const isSelected = displayedTheme === mode.value;
          const isPending = pendingTheme === mode.value;
          
          return (
            <Button
              key={mode.value}
              variant={isSelected ? 'primary' : 'secondary'}
              size="small"
              onPress={() => handleThemeChange(mode.value)}
              loading={isPending}
              icon={
                !isPending ? (
                  <Ionicons
                    name={mode.icon}
                    size={20}
                    color={
                      isSelected
                        ? theme.colors.button.primary.text
                        : theme.colors.text.primary
                    }
                  />
                ) : undefined
              }
              style={styles.themeButton}
            >
              {mode.label}
            </Button>
          );
        })}
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