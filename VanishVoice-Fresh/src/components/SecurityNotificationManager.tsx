import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSecurity } from '../contexts/SecurityContext';
import ScreenshotNotificationBanner from './ScreenshotNotificationBanner';
import PremiumSecurityUpsell from './PremiumSecurityUpsell';
import monetizationAnalytics from '../services/monetizationAnalytics';

interface SecurityNotification {
  id: string;
  type: 'screenshot_detected' | 'screenshot_blocked' | 'security_alert';
  messageId?: string;
  messageType?: 'voice' | 'video' | 'text';
  timestamp: Date;
  metadata?: {
    screenshotCount?: number;
    platform?: 'ios' | 'android';
    context?: any;
  };
}

interface SecurityNotificationManagerProps {
  onNavigateToSecurity?: () => void;
  onNavigateToPremium?: () => void;
}

export default function SecurityNotificationManager({
  onNavigateToSecurity,
  onNavigateToPremium,
}: SecurityNotificationManagerProps) {
  const theme = useAppTheme();
  const { isPremiumUser, screenshotAttempts } = useSecurity();
  
  const [activeNotification, setActiveNotification] = useState<SecurityNotification | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [notificationQueue, setNotificationQueue] = useState<SecurityNotification[]>([]);

  // Listen for new screenshot events
  useEffect(() => {
    // This would be called when a screenshot is detected
    // In a real implementation, this would listen to security events
    const handleSecurityEvent = (event: any) => {
      const notification: SecurityNotification = {
        id: `${Date.now()}-${Math.random()}`,
        type: event.type,
        messageId: event.messageId,
        messageType: event.messageType,
        timestamp: new Date(),
        metadata: event.metadata,
      };

      addNotificationToQueue(notification);
    };

    // This is a placeholder - in real implementation, you'd listen to actual events
    // For demo purposes, we can trigger this manually
    
    return () => {
      // Cleanup listeners
    };
  }, []);

  const addNotificationToQueue = useCallback((notification: SecurityNotification) => {
    // Track screenshot-triggered monetization opportunity
    if (notification.type === 'screenshot_detected' && !isPremiumUser) {
      monetizationAnalytics.trackScreenshotTrigger('screenshot_detected', {
        messageType: notification.messageType,
        platform: notification.metadata?.platform,
        screenshotCount: notification.metadata?.screenshotCount,
        userSegment: 'free',
      });
    }
    
    setNotificationQueue(prev => [...prev, notification]);
    
    // If no notification is currently active, show this one
    if (!activeNotification) {
      setActiveNotification(notification);
      setNotificationQueue(prev => prev.slice(1));
    }
  }, [activeNotification, isPremiumUser]);

  const handleNotificationDismiss = useCallback(() => {
    setActiveNotification(null);
    
    // Show next notification in queue after a delay
    setTimeout(() => {
      if (notificationQueue.length > 0) {
        setActiveNotification(notificationQueue[0]);
        setNotificationQueue(prev => prev.slice(1));
      }
    }, 500);
  }, [notificationQueue]);

  const handleUpgradePress = useCallback(() => {
    // Determine the trigger based on the current notification
    let trigger: 'screenshot_detected' | 'screenshot_blocked' | 'security_dashboard' | 'manual' = 'manual';
    
    if (activeNotification) {
      switch (activeNotification.type) {
        case 'screenshot_detected':
          trigger = 'screenshot_detected';
          break;
        case 'screenshot_blocked':
          trigger = 'screenshot_blocked';
          break;
        default:
          trigger = 'security_dashboard';
      }
    }

    setShowUpsell(true);
    // Don't dismiss the notification immediately - let user choose
  }, [activeNotification]);

  const handleUpsellClose = useCallback(() => {
    setShowUpsell(false);
  }, []);

  const handlePremiumUpgrade = useCallback(() => {
    setShowUpsell(false);
    if (onNavigateToPremium) {
      onNavigateToPremium();
    }
    // Optionally dismiss the current notification
    handleNotificationDismiss();
  }, [onNavigateToPremium, handleNotificationDismiss]);

  const handleViewDetails = useCallback(() => {
    if (onNavigateToSecurity) {
      onNavigateToSecurity();
    }
    handleNotificationDismiss();
  }, [onNavigateToSecurity, handleNotificationDismiss]);

  // Helper method to manually trigger notifications (for testing/demo)
  const triggerScreenshotNotification = useCallback((
    messageType: 'voice' | 'video' | 'text' = 'voice',
    messageId?: string
  ) => {
    const notification: SecurityNotification = {
      id: `demo-${Date.now()}`,
      type: 'screenshot_detected',
      messageId,
      messageType,
      timestamp: new Date(),
      metadata: {
        screenshotCount: 1,
        platform: 'ios',
      },
    };

    addNotificationToQueue(notification);
  }, [addNotificationToQueue]);

  // Expose trigger method for external use (development/testing)
  React.useImperativeHandle(React.useRef(), () => ({
    triggerScreenshotNotification,
  }), [triggerScreenshotNotification]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Screenshot Notification Banner */}
      <ScreenshotNotificationBanner
        visible={!!activeNotification}
        messageType={activeNotification?.messageType}
        messageId={activeNotification?.messageId}
        onDismiss={handleNotificationDismiss}
        onUpgrade={!isPremiumUser ? handleUpgradePress : undefined}
        onViewDetails={handleViewDetails}
      />

      {/* Premium Upsell Modal */}
      <PremiumSecurityUpsell
        visible={showUpsell && !isPremiumUser}
        onClose={handleUpsellClose}
        onUpgrade={handlePremiumUpgrade}
        trigger={
          activeNotification?.type === 'screenshot_detected' 
            ? 'screenshot_detected' 
            : activeNotification?.type === 'screenshot_blocked'
            ? 'screenshot_blocked'
            : 'security_dashboard'
        }
        screenshotCount={activeNotification?.metadata?.screenshotCount || 1}
      />
    </View>
  );
}

// Helper hook for using the notification manager
export function useSecurityNotifications() {
  const managerRef = React.useRef<any>(null);

  const triggerScreenshotDetected = useCallback((
    messageType: 'voice' | 'video' | 'text',
    messageId?: string
  ) => {
    if (managerRef.current?.triggerScreenshotNotification) {
      managerRef.current.triggerScreenshotNotification(messageType, messageId);
    }
  }, []);

  return {
    triggerScreenshotDetected,
    managerRef,
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
  },
});