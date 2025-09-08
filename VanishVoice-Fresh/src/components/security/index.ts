/**
 * Security UX Components
 * 
 * A comprehensive security notification system for the VanishVoice app
 * featuring cyberpunk-themed designs and premium conversion optimization.
 */

export { default as ScreenshotNotificationBanner } from '../ScreenshotNotificationBanner';
export { default as SecurityTrustScore } from '../SecurityTrustScore';
export { default as PremiumSecurityUpsell } from '../PremiumSecurityUpsell';
export { default as SecurityAnalyticsDashboard } from '../SecurityAnalyticsDashboard';
export { default as SecurityNotificationManager, useSecurityNotifications } from '../SecurityNotificationManager';

// Types
export interface SecurityNotificationProps {
  visible: boolean;
  messageType?: 'voice' | 'video' | 'text';
  messageId?: string;
  onDismiss: () => void;
  onUpgrade?: () => void;
  onViewDetails?: () => void;
}

export interface SecurityTrustScoreProps {
  screenshotAttempts?: number;
  messageId?: string;
  messageType?: 'voice' | 'video' | 'text';
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  variant?: 'badge' | 'inline' | 'header';
}

export interface PremiumSecurityUpsellProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  trigger: 'screenshot_detected' | 'screenshot_blocked' | 'security_dashboard' | 'manual';
  screenshotCount?: number;
}

/**
 * Security UX Design Guidelines
 * 
 * Colors:
 * - iOS (Detection): Neon Pink (#FF1B8D) - Screenshot detection notifications
 * - Android (Prevention): Cyber Blue (#00D9FF) - Screenshot blocking notifications  
 * - Premium Features: Electric Purple (#B026FF) - Upgrade prompts and premium indicators
 * 
 * User Experience Principles:
 * 1. Non-intrusive but attention-getting notifications
 * 2. Clear platform-specific messaging (iOS detection vs Android blocking)
 * 3. Premium conversion triggered by security events
 * 4. Trust building through transparency and security metrics
 * 5. Cyberpunk aesthetic matching VanishVoice brand
 * 
 * Conversion Strategy:
 * - Screenshot detected → "Upgrade to prevent screenshots" (urgency)
 * - Security dashboard → "Get advanced analytics" (value)
 * - Multiple screenshots → "Your content is being saved" (concern)
 * 
 * Implementation Notes:
 * - SecurityNotificationManager handles global notification orchestration
 * - Components follow the existing VanishVoice theme system
 * - All animations use native drivers for performance
 * - Premium features clearly differentiated with visual indicators
 */