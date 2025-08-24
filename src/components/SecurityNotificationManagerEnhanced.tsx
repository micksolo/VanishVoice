import React, { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AnonymousAuthContext';

interface SecurityNotificationManagerProps {
  onScreenshotDetected?: (data: any) => void;
  enabled?: boolean;
}

/**
 * Enhanced Security Notification Manager
 * 
 * Handles cross-device notifications for screenshot detection.
 * Ensures message OWNERS are notified when someone screenshots their content,
 * not the person taking the screenshot.
 */
export default function SecurityNotificationManagerEnhanced({
  onScreenshotDetected,
  enabled = true
}: SecurityNotificationManagerProps) {
  const { user } = useAuth();
  const lastNotificationId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !user?.id) {
      return;
    }

    console.log('[SecurityNotificationManager] Setting up enhanced notification listener for user:', user.id);

    // Subscribe to notifications table for immediate cross-device alerts
    const notificationChannel = supabase
      .channel(`enhanced-security-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new;
          
          // Prevent duplicate notifications
          if (notification.id === lastNotificationId.current) {
            console.log('[SecurityNotificationManager] Skipping duplicate notification:', notification.id);
            return;
          }
          
          lastNotificationId.current = notification.id;
          
          console.log('[SecurityNotificationManager] Notification received:', {
            id: notification.id,
            type: notification.type,
            title: notification.title
          });

          if (notification.type === 'screenshot_detected') {
            const notificationData = notification.data || {};
            
            console.log('[SecurityNotificationManager] 🚨 Screenshot detected notification:', {
              messageId: notificationData.message_id,
              screenshotterId: notificationData.screenshotter_id,
              recipient: user.id
            });

            // Show alert to message owner (this user)
            Alert.alert(
              '📸 Screenshot Detected',
              'Someone just took a screenshot of your message.',
              [
                { 
                  text: 'OK', 
                  style: 'default',
                  onPress: () => {
                    // Mark notification as read
                    supabase
                      .from('notifications')
                      .update({ read: true })
                      .eq('id', notification.id)
                      .then(({ error }) => {
                        if (error) {
                          console.error('[SecurityNotificationManager] Failed to mark as read:', error);
                        }
                      });
                  }
                },
                { 
                  text: 'Security Details', 
                  style: 'default',
                  onPress: () => {
                    console.log('[SecurityNotificationManager] Show security dashboard');
                    // Could navigate to security screen
                    if (onScreenshotDetected) {
                      onScreenshotDetected(notificationData);
                    }
                  }
                }
              ]
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('[SecurityNotificationManager] Subscription status:', status);
      });

    // Cleanup subscription
    return () => {
      console.log('[SecurityNotificationManager] Cleaning up notification listener');
      notificationChannel.unsubscribe();
    };
  }, [user?.id, enabled, onScreenshotDetected]);

  // This component doesn't render anything
  return null;
}

export { SecurityNotificationManagerEnhanced };