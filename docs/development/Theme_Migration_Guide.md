# Theme Migration Guide

This guide provides a step-by-step process for migrating screens and components to use the new theme system in VanishVoice.

## Overview

The new theme system provides:
- Consistent colors, typography, and spacing
- Dark/light mode support
- Typed theme access via `useAppTheme()` hook
- Pre-built UI components that automatically use theme values

## Migration Checklist

### 1. Import Required Dependencies

Replace:
```typescript
import { SafeAreaView } from 'react-native';
```

With:
```typescript
import { SafeAreaView, Button, Card, IconButton, Input, Loading, EmptyState } from '../components/ui';
import { useAppTheme } from '../contexts/ThemeContext';
```

### 2. Access Theme in Component

Add at the top of your component:
```typescript
const theme = useAppTheme();
```

### 3. Replace Hardcoded Colors

| Old | New |
|-----|-----|
| `#1A1A1A` (black text) | `theme.colors.text.primary` |
| `#666` (gray text) | `theme.colors.text.secondary` |
| `#999` (light gray) | `theme.colors.text.tertiary` |
| `#4ECDC4` (teal accent) | `theme.colors.text.accent` |
| `#fff` (white) | `theme.colors.text.inverse` |
| `#F5F5F5` (light bg) | `theme.colors.background.secondary` |
| `#FF3B30` (red/error) | `theme.colors.status.error` |
| `#4CD964` (green/success) | `theme.colors.status.success` |
| `#FF9800` (orange/warning) | `theme.colors.status.warning` |
| `#007AFF` (blue/info) | `theme.colors.status.info` |

### 4. Replace Typography Styles

| Old | New |
|-----|-----|
| `fontSize: 24, fontWeight: 'bold'` | `...theme.typography.displaySmall` |
| `fontSize: 20, fontWeight: '600'` | `...theme.typography.headlineLarge` |
| `fontSize: 18, fontWeight: '600'` | `...theme.typography.headlineMedium` |
| `fontSize: 16, fontWeight: '600'` | `...theme.typography.headlineSmall` |
| `fontSize: 16` | `...theme.typography.bodyLarge` |
| `fontSize: 14` | `...theme.typography.bodyMedium` |
| `fontSize: 12` | `...theme.typography.bodySmall` |
| `fontSize: 12` (labels) | `...theme.typography.labelMedium` |
| `fontSize: 10` | `...theme.typography.labelSmall` |

### 5. Replace Spacing Values

| Old | New |
|-----|-----|
| `padding: 4` | `padding: theme.spacing.xs` |
| `padding: 8` | `padding: theme.spacing.sm` |
| `padding: 12` | `padding: theme.spacing.md` |
| `padding: 16` | `padding: theme.spacing.lg` |
| `padding: 20` | `padding: theme.spacing.xl` |
| `padding: 24` | `padding: theme.spacing.xxl` |
| `gap: 8` | `gap: theme.spacing.sm` |

### 6. Update Touch Targets

Ensure all touchable elements meet minimum size requirements:
```typescript
minHeight: theme.touchTargets.medium, // 44px
// or
minHeight: theme.touchTargets.large,  // 56px
```

### 7. Replace Native Components with Themed Components

#### SafeAreaView
```typescript
// Old
<SafeAreaView style={styles.container}>

// New
<SafeAreaView style={{ flex: 1 }}>
```

#### Buttons
```typescript
// Old
<TouchableOpacity style={styles.button} onPress={handlePress}>
  <Text style={styles.buttonText}>Click Me</Text>
</TouchableOpacity>

// New
<Button variant="primary" onPress={handlePress}>
  Click Me
</Button>
```

#### Icon Buttons
```typescript
// Old
<TouchableOpacity onPress={handlePress}>
  <Ionicons name="add" size={24} color="#4ECDC4" />
</TouchableOpacity>

// New
<IconButton
  icon={<Ionicons name="add" size={24} color={theme.colors.text.accent} />}
  onPress={handlePress}
  size="medium"
  variant="ghost"
/>
```

#### Cards
```typescript
// Old
<View style={styles.card}>
  {content}
</View>

// New
<Card elevation="small">
  {content}
</Card>
```

#### Text Inputs
```typescript
// Old
<TextInput
  style={styles.input}
  value={value}
  onChangeText={onChange}
  placeholder="Enter text"
/>

// New
<Input
  label="Label"
  value={value}
  onChangeText={onChange}
  placeholder="Enter text"
  error={errorMessage}
  helperText="Helper text"
/>
```

#### Empty States
```typescript
// Old
<View style={styles.emptyContainer}>
  <Ionicons name="inbox-outline" size={64} color="#ccc" />
  <Text style={styles.emptyTitle}>No Items</Text>
  <Text style={styles.emptySubtitle}>Add some items to get started</Text>
</View>

// New
<EmptyState
  icon="inbox-outline"
  title="No Items"
  subtitle="Add some items to get started"
  action={{ label: "Add Item", onPress: handleAddItem }}
/>
```

#### Loading States
```typescript
// Old
<ActivityIndicator size="large" color="#4ECDC4" />

// New
<Loading />
// or
<Loading fullScreen text="Loading..." />
```

### 8. Update StyleSheet

Convert styles to use theme:
```typescript
// Old
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  // ...
});

// New
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  // ...
});

// In component:
const styles = getStyles(theme);
```

### 9. Handle Dark Mode

The theme automatically handles dark mode. Just ensure you're using theme colors instead of hardcoded values.

## Common Patterns

### Modal Styling
```typescript
<Modal visible={visible} animationType="slide">
  <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
    <View style={{
      flexDirection: 'row',
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.subtle,
    }}>
      {/* Modal header */}
    </View>
    {/* Modal content */}
  </SafeAreaView>
</Modal>
```

### List Item Styling
```typescript
<TouchableOpacity style={{
  flexDirection: 'row',
  alignItems: 'center',
  padding: theme.spacing.md,
  backgroundColor: theme.colors.background.primary,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border.subtle,
  minHeight: theme.touchTargets.large,
}}>
  {/* List item content */}
</TouchableOpacity>
```

### Status Indicators
```typescript
// Success
<View style={{ backgroundColor: theme.colors.status.success + '20' }}>
  <Ionicons name="checkmark-circle" color={theme.colors.status.success} />
</View>

// Warning
<View style={{ backgroundColor: theme.colors.status.warning + '20' }}>
  <Ionicons name="warning" color={theme.colors.status.warning} />
</View>
```

## Migration Status

### ✅ Completed
- ProfileScreen (partially - still uses some inline styles)
- FriendsListScreen
- AppNavigator
- Base UI components

### 🚧 In Progress
- FriendChatScreen
- Message components

### ⏳ Pending
- AnonymousChatScreen
- AnonymousLobbyScreen
- AuthScreen
- EphemeralInboxScreen
- MessagePreviewScreen
- All recording/playback components

## Tips

1. Start with the most used screens first
2. Test both light and dark modes after migration
3. Use the ThemeDemo screen to see all available theme values
4. When in doubt, check existing migrated screens for patterns
5. Always use semantic color names (e.g., `text.primary` not `gray.900`)