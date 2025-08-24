# Security UX Integration Guide

This guide explains how to integrate the new security notification system into VanishVoice screens and components.

## Overview

The security UX system consists of five main components:

1. **ScreenshotNotificationBanner** - Premium in-app notification banners
2. **SecurityTrustScore** - Trust indicators showing screenshot attempt counts  
3. **PremiumSecurityUpsell** - Context-aware premium conversion modals
4. **SecurityAnalyticsDashboard** - Security metrics and analytics
5. **SecurityNotificationManager** - Global notification orchestration

## Quick Start

### 1. Add Security Notification Manager

Add the `SecurityNotificationManager` to your main app or screen layout:

```tsx
import { SecurityNotificationManager } from '../components/security';

function ChatScreen() {
  return (
    <View style={{ flex: 1 }}>
      {/* Your existing content */}
      <ChatMessages />
      
      {/* Add notification manager at the end */}
      <SecurityNotificationManager
        onNavigateToSecurity={() => navigation.navigate('SecurityScreen')}
        onNavigateToPremium={() => navigation.navigate('PremiumScreen')}
      />
    </View>
  );
}
```

### 2. Enhanced Message Bubbles

Update message bubbles to show security trust indicators:

```tsx
<MessageBubble
  content="Voice message content"
  isMine={true}
  timestamp={new Date()}
  messageType="voice"
  status="read"
  screenshotAttempts={2} // Pass screenshot count from database
  showSecurityTrustScore={true} // Enable trust indicators
/>
```

### 3. Security Analytics Dashboard

Add the security dashboard to a dedicated screen or settings:

```tsx
import { SecurityAnalyticsDashboard } from '../components/security';

function SecurityScreen() {
  return (
    <SecurityAnalyticsDashboard
      onUpgrade={() => navigation.navigate('PremiumScreen')}
      showHeader={true}
      compactMode={false}
    />
  );
}
```

## Component APIs

### ScreenshotNotificationBanner

Premium notification banners that appear when screenshots are detected.

```tsx
<ScreenshotNotificationBanner
  visible={showNotification}
  messageType="voice" // 'voice' | 'video' | 'text'
  messageId="msg_123"
  onDismiss={() => setShowNotification(false)}
  onUpgrade={() => navigation.navigate('PremiumScreen')}
  onViewDetails={() => navigation.navigate('SecurityScreen')}
/>
```

**Features:**
- Cyberpunk-themed animations and gradients
- Platform-specific messaging (iOS detection vs Android blocking)
- Auto-hide after 8 seconds
- Conversion-optimized upgrade buttons

### SecurityTrustScore

Visual indicators showing screenshot attempt counts and security status.

```tsx
<SecurityTrustScore
  screenshotAttempts={3}
  messageId="msg_123"
  messageType="voice"
  variant="badge" // 'badge' | 'inline' | 'header'
  size="medium" // 'small' | 'medium' | 'large'
  showLabel={true}
  onPress={() => showSecurityDetails()}
/>
```

**Trust Levels:**
- **Secure** (0 screenshots): Cyber blue, shield icon
- **Monitored** (1-2 screenshots): Neon pink, eye icon  
- **Compromised** (3+ screenshots): Red, warning icon

### PremiumSecurityUpsell

Context-aware premium conversion modals triggered by security events.

```tsx
<PremiumSecurityUpsell
  visible={showUpsell}
  onClose={() => setShowUpsell(false)}
  onUpgrade={() => startPremiumFlow()}
  trigger="screenshot_detected" // Determines messaging and urgency
  screenshotCount={2}
/>
```

**Triggers:**
- `screenshot_detected` - "Your message was screenshotted" (high urgency)
- `screenshot_blocked` - "Protection working" (social proof)
- `security_dashboard` - "Upgrade security" (value proposition)
- `manual` - Generic premium prompt

### SecurityAnalyticsDashboard

Comprehensive security analytics with real-time metrics.

```tsx
<SecurityAnalyticsDashboard
  onUpgrade={() => startPremiumFlow()}
  showHeader={true}
  compactMode={false} // Set true for embedded use
/>
```

**Features:**
- Total screenshot attempts
- Weekly trends
- Voice/video message protection stats
- Recent activity timeline
- Premium feature comparison

### SecurityNotificationManager

Global notification orchestrator that manages notification queue and timing.

```tsx
const { triggerScreenshotDetected, managerRef } = useSecurityNotifications();

// Trigger notification when screenshot detected
useEffect(() => {
  if (screenshotEvent) {
    triggerScreenshotDetected(messageType, messageId);
  }
}, [screenshotEvent]);
```

## Integration with Existing Systems

### Screenshot Detection Hook

Update your screenshot detection hook to trigger notifications:

```tsx
// In useScreenshotSecurity.ts
import { useSecurityNotifications } from '../components/security';

const { triggerScreenshotDetected } = useSecurityNotifications();

const handleScreenshotDetected = (messageId?: string) => {
  // Existing screenshot logic...
  
  // Trigger notification
  triggerScreenshotDetected(messageType, messageId);
};
```

### Database Integration

Add screenshot attempt counts to your message queries:

```sql
-- Get messages with screenshot counts
SELECT 
  m.*,
  COUNT(sa.id) as screenshot_attempts
FROM messages m
LEFT JOIN screenshot_attempts sa ON sa.message_id = m.id
GROUP BY m.id
ORDER BY m.created_at DESC;
```

### Premium Feature Gates

Use security events to trigger premium conversions:

```tsx
// When user sees multiple screenshots
useEffect(() => {
  if (screenshotAttempts >= 2 && !isPremiumUser) {
    // Show urgency-based upsell
    setShowUpsell(true);
  }
}, [screenshotAttempts, isPremiumUser]);
```

## Design Guidelines

### Color System

- **iOS (Detection)**: Neon Pink (`#FF1B8D`) for screenshot detection
- **Android (Blocking)**: Cyber Blue (`#00D9FF`) for screenshot prevention  
- **Premium Features**: Electric Purple (`#B026FF`) for upgrade prompts
- **Secure Status**: Cyber Blue for protected messages
- **Compromised Status**: Red (`#EF4444`) for high-risk messages

### Animation Principles

- **Security Pulse**: Subtle pulsing for active security features
- **Cyberpunk Glow**: Animated glows for premium features
- **Trust Indicators**: Color-coded visual feedback
- **Smooth Transitions**: Native driver animations for performance

### Conversion Optimization

1. **Trigger-Based Messaging**: Different copy for different security events
2. **Platform Awareness**: iOS detection vs Android blocking messaging
3. **Visual Hierarchy**: Premium features clearly differentiated
4. **Social Proof**: Show protection working for premium users
5. **Urgency Creation**: Screenshot events create conversion pressure

## Testing

Use the `SecurityDemoScreen` to test all components:

```tsx
import SecurityDemoScreen from '../screens/SecurityDemoScreen';

// Add to navigation stack for testing
<Stack.Screen 
  name="SecurityDemo" 
  component={SecurityDemoScreen}
  options={{ title: 'Security UX Demo' }}
/>
```

The demo screen includes:
- Trigger buttons for different notification types
- Trust score examples
- Analytics dashboard
- Message bubble examples
- Feature documentation

## Performance Notes

- All animations use `useNativeDriver: true` where possible
- Components lazy-load heavy analytics data
- Notification queue prevents spam
- Auto-hide timers prevent memory leaks
- Trust scores only render when needed

## Accessibility

- All components include proper `accessibilityLabel`
- Color is not the only indicator (icons + text)
- Touch targets meet minimum 44pt requirements
- Screen reader announcements for security events
- High contrast mode support via theme system