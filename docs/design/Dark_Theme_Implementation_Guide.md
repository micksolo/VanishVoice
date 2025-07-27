# Dark Theme Implementation Guide for FriendChatScreen

## Current Issue
FriendChatScreen is using hardcoded colors instead of the theme system, making it inconsistent with the rest of the app and breaking dark mode support.

## Quick Fix Implementation

### Step 1: Import Theme Hook
```typescript
import { useAppTheme } from '../contexts/ThemeContext';
```

### Step 2: Add Theme to Component
```typescript
export default function FriendChatScreen({ route, navigation }: any) {
  const theme = useAppTheme();
  // ... rest of component
```

### Step 3: Convert Styles to Dynamic
Replace the static `StyleSheet.create()` with a dynamic function:

```typescript
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary, // was '#FAFAFA'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary, // was '#fff'
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default, // was '#E0E0E0'
  },
  headerTitle: {
    ...theme.typography.heading.h4,
    color: theme.colors.text.primary, // was '#1A1A1A'
  },
  // ... continue for all styles
});
```

### Step 4: Use Dynamic Styles
```typescript
const styles = getStyles(theme);
```

## Complete Color Mapping

### Backgrounds
- `#FAFAFA` → `theme.colors.background.primary`
- `#fff` → `theme.colors.background.secondary`
- `#F5F5F5` → `theme.colors.background.tertiary`

### Text Colors
- `#000` → `theme.colors.text.primary`
- `#1A1A1A` → `theme.colors.text.primary`
- `#666` → `theme.colors.text.secondary`
- `#999` → `theme.colors.text.tertiary`

### Chat Specific
- `#4ECDC4` (teal accent) → `theme.colors.chat.sent`
- `#E0E0E0` (received bubble) → `theme.colors.chat.received`
- `#FF3B30` (danger) → `theme.colors.status.error`

### Borders
- `#E0E0E0` → `theme.colors.border.default`
- `#F0F0F0` → `theme.colors.border.subtle`

## Enhanced Dark Theme Colors

To make the app more "fun" like Snapchat, update the theme colors:

### Update colors.ts
```typescript
// Add new accent colors
const palette = {
  // ... existing colors
  
  // Neon accents
  neonPurple: '#B026FF',
  neonPink: '#FF006E',
  neonBlue: '#00D9FF',
  neonGreen: '#39FF14',
  
  // Dark backgrounds
  richBlack: '#0A0A0F',
  darkNavy: '#1A1A24',
  darkPurple: '#252534',
};

// Update dark theme colors
export const darkColors = {
  background: {
    primary: palette.richBlack,      // Darker background
    secondary: palette.darkNavy,      // Slightly lighter
    tertiary: palette.darkPurple,     // For cards
    elevated: palette.darkPurple,     // Modals
    overlay: 'rgba(0, 0, 0, 0.8)',   // More opaque
  },
  
  // Make chat more vibrant
  chat: {
    sent: palette.neonPurple,         // Neon purple for sent
    received: palette.darkPurple,     // Dark but visible
    sentText: palette.white,
    receivedText: palette.gray100,
  },
  
  // Update accent colors
  accent: {
    primary: palette.neonPurple,
    secondary: palette.neonPink,
    teal: palette.neonBlue,           // Replace teal with neon blue
    success: palette.neonGreen,
  },
};
```

## Fun Enhancements for Chat

### 1. Gradient Message Bubbles
```typescript
// Add to chat bubble styles
import LinearGradient from 'react-native-linear-gradient';

// In render
<LinearGradient
  colors={item.isMine ? ['#B026FF', '#FF006E'] : ['#252534', '#1A1A24']}
  style={styles.messageBubble}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
>
  <Text style={styles.messageText}>{item.content}</Text>
</LinearGradient>
```

### 2. Animated Message Entry
```typescript
const animatedValue = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.spring(animatedValue, {
    toValue: 1,
    tension: 50,
    friction: 7,
    useNativeDriver: true,
  }).start();
}, []);

// In render
<Animated.View
  style={[
    styles.messageBubble,
    {
      transform: [
        {
          scale: animatedValue,
        },
        {
          translateY: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0],
          }),
        },
      ],
      opacity: animatedValue,
    },
  ]}
>
```

### 3. Typing Indicator with Dots
```typescript
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);
  
  return (
    <View style={styles.typingContainer}>
      {[dot1, dot2, dot3].map((dot, index) => (
        <Animated.View
          key={index}
          style={[
            styles.typingDot,
            {
              opacity: dot,
              transform: [{
                scale: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.2],
                }),
              }],
            },
          ]}
        />
      ))}
    </View>
  );
};
```

## Testing Checklist

- [ ] Test in light mode
- [ ] Test in dark mode
- [ ] Test system theme following
- [ ] Verify all text is readable
- [ ] Check contrast ratios
- [ ] Test on iOS and Android
- [ ] Verify animations are smooth
- [ ] Check memory usage with animations

## Common Pitfalls to Avoid

1. **Don't forget status bar**: Use `StatusBar` component to match theme
2. **Check keyboard appearance**: Set keyboard appearance based on theme
3. **Update navigation bar**: Ensure navigation matches theme
4. **Test on real devices**: Simulators may not show true colors
5. **Consider battery impact**: Dark themes should save battery on OLED

## Migration Checklist

1. [ ] Import useAppTheme hook
2. [ ] Convert StyleSheet to dynamic function
3. [ ] Replace all hardcoded colors
4. [ ] Add theme animations
5. [ ] Test thoroughly
6. [ ] Update other chat screens for consistency
7. [ ] Document any theme-specific behaviors