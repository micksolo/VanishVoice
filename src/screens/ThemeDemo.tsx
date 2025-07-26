/**
 * Theme Demo Screen for WYD app
 * Shows all theme components and styles
 */

import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { 
  SafeAreaView, 
  Button, 
  Input, 
  Card, 
  CardSection,
  Loading,
  Header,
  IconButton
} from '../components/ui';
import { ThemeSelector } from '../components/ThemeSelector';

export default function ThemeDemo() {
  const theme = useAppTheme();
  const [inputValue, setInputValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  return (
    <SafeAreaView>
      <Header 
        title="Theme Demo" 
        subtitle="Component Showcase"
        showBack={false}
      />
      
      <ScrollView 
        style={{ backgroundColor: theme.colors.background.secondary }}
        contentContainerStyle={styles.container}
      >
        {/* Theme Selector */}
        <ThemeSelector />
        
        {/* Typography */}
        <Card style={styles.section} elevation="small">
          <Text style={[theme.typography.headlineMedium, { color: theme.colors.text.primary }]}>
            Typography
          </Text>
          
          <View style={styles.typographyItem}>
            <Text style={[theme.typography.displayLarge, { color: theme.colors.text.primary }]}>
              Display Large
            </Text>
          </View>
          
          <View style={styles.typographyItem}>
            <Text style={[theme.typography.headlineLarge, { color: theme.colors.text.primary }]}>
              Headline Large
            </Text>
          </View>
          
          <View style={styles.typographyItem}>
            <Text style={[theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>
              Body Large - Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </Text>
          </View>
          
          <View style={styles.typographyItem}>
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
              Caption - Supporting text
            </Text>
          </View>
        </Card>

        {/* Buttons */}
        <Card style={styles.section} elevation="small">
          <Text style={[theme.typography.headlineMedium, { color: theme.colors.text.primary, marginBottom: theme.spacing.lg }]}>
            Buttons
          </Text>
          
          <Button variant="primary" style={styles.button}>
            Primary Button
          </Button>
          
          <Button variant="secondary" style={styles.button}>
            Secondary Button
          </Button>
          
          <Button variant="tertiary" style={styles.button}>
            Tertiary Button
          </Button>
          
          <Button variant="danger" style={styles.button}>
            Danger Button
          </Button>
          
          <Button 
            variant="primary" 
            icon={<Ionicons name="send" size={20} color={theme.colors.button.primary.text} />}
            style={styles.button}
          >
            Button with Icon
          </Button>
          
          <Button variant="primary" loading style={styles.button}>
            Loading Button
          </Button>
          
          <Button variant="primary" disabled style={styles.button}>
            Disabled Button
          </Button>
        </Card>

        {/* Icon Buttons */}
        <Card style={styles.section} elevation="small">
          <Text style={[theme.typography.headlineMedium, { color: theme.colors.text.primary, marginBottom: theme.spacing.lg }]}>
            Icon Buttons
          </Text>
          
          <View style={styles.iconButtonRow}>
            <IconButton
              icon={<Ionicons name="heart-outline" size={24} color={theme.colors.text.primary} />}
              variant="ghost"
            />
            <IconButton
              icon={<Ionicons name="share-outline" size={24} color={theme.colors.text.inverse} />}
              variant="filled"
            />
            <IconButton
              icon={<Ionicons name="bookmark-outline" size={24} color={theme.colors.text.primary} />}
              variant="outlined"
            />
          </View>
        </Card>

        {/* Inputs */}
        <Card style={styles.section} elevation="small">
          <Text style={[theme.typography.headlineMedium, { color: theme.colors.text.primary, marginBottom: theme.spacing.lg }]}>
            Inputs
          </Text>
          
          <Input
            label="Username"
            placeholder="Enter your username"
            value={inputValue}
            onChangeText={setInputValue}
            leftIcon={<Ionicons name="person-outline" size={20} color={theme.colors.text.tertiary} />}
          />
          
          <Input
            label="Password"
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            rightIcon={
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color={theme.colors.text.tertiary} 
              />
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
          />
          
          <Input
            label="Email with Error"
            placeholder="email@example.com"
            error="Please enter a valid email address"
            leftIcon={<Ionicons name="mail-outline" size={20} color={theme.colors.text.error} />}
          />
          
          <Input
            label="Disabled Input"
            value="This input is disabled"
            editable={false}
          />
        </Card>

        {/* Cards */}
        <Card style={styles.section} elevation="small">
          <Text style={[theme.typography.headlineMedium, { color: theme.colors.text.primary, marginBottom: theme.spacing.lg }]}>
            Card Elevations
          </Text>
          
          <Card elevation="none" style={styles.nestedCard}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              No elevation
            </Text>
          </Card>
          
          <Card elevation="small" style={styles.nestedCard}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              Small elevation
            </Text>
          </Card>
          
          <Card elevation="medium" style={styles.nestedCard}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              Medium elevation
            </Text>
          </Card>
          
          <Card elevation="large" style={styles.nestedCard}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              Large elevation
            </Text>
          </Card>
        </Card>

        {/* Colors */}
        <Card style={styles.section} elevation="small">
          <Text style={[theme.typography.headlineMedium, { color: theme.colors.text.primary, marginBottom: theme.spacing.lg }]}>
            Colors
          </Text>
          
          <View style={styles.colorRow}>
            <View style={[styles.colorBox, { backgroundColor: theme.colors.button.primary.background }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.inverse }]}>Primary</Text>
            </View>
            <View style={[styles.colorBox, { backgroundColor: theme.colors.text.accent }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.inverse }]}>Accent</Text>
            </View>
            <View style={[styles.colorBox, { backgroundColor: theme.colors.status.success }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.inverse }]}>Success</Text>
            </View>
          </View>
          
          <View style={styles.colorRow}>
            <View style={[styles.colorBox, { backgroundColor: theme.colors.status.warning }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.inverse }]}>Warning</Text>
            </View>
            <View style={[styles.colorBox, { backgroundColor: theme.colors.status.error }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.inverse }]}>Error</Text>
            </View>
            <View style={[styles.colorBox, { backgroundColor: theme.colors.status.info }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.inverse }]}>Info</Text>
            </View>
          </View>
        </Card>

        {/* Loading States */}
        <Card style={styles.section} elevation="small">
          <Text style={[theme.typography.headlineMedium, { color: theme.colors.text.primary, marginBottom: theme.spacing.lg }]}>
            Loading States
          </Text>
          
          <Loading size="small" text="Small loading..." />
          <View style={{ height: theme.spacing.md }} />
          <Loading size="large" text="Large loading..." />
        </Card>

        {/* Spacing */}
        <Card style={[styles.section, { marginBottom: theme.spacing.xxl }]} elevation="small">
          <Text style={[theme.typography.headlineMedium, { color: theme.colors.text.primary, marginBottom: theme.spacing.lg }]}>
            Spacing
          </Text>
          
          {Object.entries(theme.spacing).map(([key, value]) => (
            <View key={key} style={styles.spacingItem}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
                {key}: {value}px
              </Text>
              <View style={[styles.spacingBar, { width: value, backgroundColor: theme.colors.button.primary.background }]} />
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  section: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  button: {
    marginBottom: 12,
  },
  typographyItem: {
    marginVertical: 8,
  },
  iconButtonRow: {
    flexDirection: 'row',
    gap: 16,
  },
  nestedCard: {
    marginBottom: 12,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  colorBox: {
    flex: 1,
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  spacingBar: {
    height: 20,
    borderRadius: 4,
  },
});