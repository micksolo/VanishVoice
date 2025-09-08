import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSecurity } from '../contexts/SecurityContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ScreenshotNotificationBannerProps {
  visible: boolean;
  messageType?: 'voice' | 'video' | 'text';
  messageId?: string;
  onDismiss: () => void;
  onUpgrade?: () => void;
  onViewDetails?: () => void;
}

export default function ScreenshotNotificationBanner({
  visible,
  messageType = 'voice',
  messageId,
  onDismiss,
  onUpgrade,
  onViewDetails,
}: ScreenshotNotificationBannerProps) {
  const theme = useAppTheme();
  const { isPremiumUser } = useSecurity();
  
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout>();

  useEffect(() => {
    if (visible) {
      // Entrance animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        // Security pulse effect
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ),
        // Cyberpunk glow
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: false,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.3,
              duration: 2000,
              useNativeDriver: false,
            }),
          ])
        ),
      ]).start();

      // Auto-hide after 8 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 8000);
      setAutoHideTimer(timer);
    } else {
      // Exit animation
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  const getNotificationContent = () => {
    const isIOS = Platform.OS === 'ios';
    
    if (isIOS) {
      return {
        icon: 'camera' as const,
        title: 'Screenshot Detected',
        subtitle: `Someone screenshotted your ${messageType} message`,
        color: theme.colors.neon?.neonPink || '#FF1B8D',
        gradientColors: ['#FF1B8D', '#B026FF'],
      };
    } else {
      return {
        icon: 'shield-checkmark' as const,
        title: isPremiumUser ? 'Screenshot Blocked' : 'Screenshot Attempt',
        subtitle: isPremiumUser 
          ? `Your ${messageType} message was protected` 
          : `Someone tried to screenshot your ${messageType} message`,
        color: theme.colors.neon?.cyberBlue || '#00D9FF',
        gradientColors: ['#00D9FF', '#B026FF'],
      };
    }
  };

  const notificationContent = getNotificationContent();

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Cyberpunk glow effect */}
      <Animated.View
        style={[
          styles.glowEffect,
          {
            opacity: glowAnim,
            shadowColor: notificationContent.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 20,
            elevation: 20,
          },
        ]}
      />
      
      <LinearGradient
        colors={[
          notificationContent.gradientColors[0] + 'DD',
          notificationContent.gradientColors[1] + 'DD',
          theme.colors.background.primary + 'F5',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.notificationBanner}
      >
        {/* Security pulse indicator */}
        <Animated.View
          style={[
            styles.securityIndicator,
            {
              backgroundColor: notificationContent.color,
              opacity: pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
              transform: [{
                scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.2],
                })
              }],
            },
          ]}
        />

        {/* Main content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={notificationContent.icon}
              size={24}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.title, theme.typography.labelLarge]}>
              {notificationContent.title}
            </Text>
            <Text style={[styles.subtitle, theme.typography.bodyMedium]}>
              {notificationContent.subtitle}
            </Text>

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              {onViewDetails && (
                <TouchableOpacity
                  onPress={onViewDetails}
                  style={styles.actionButton}
                >
                  <Text style={[styles.actionButtonText, { color: theme.colors.neon?.cyberBlue }]}>
                    View Details
                  </Text>
                </TouchableOpacity>
              )}

              {!isPremiumUser && onUpgrade && (
                <TouchableOpacity
                  onPress={onUpgrade}
                  style={[styles.upgradeButton, { backgroundColor: theme.colors.neon?.electricPurple }]}
                >
                  <Ionicons name="shield" size={12} color="#FFFFFF" />
                  <Text style={styles.upgradeButtonText}>
                    Upgrade Pro
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Dismiss button */}
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.dismissButton}
          >
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        {/* Platform indicator */}
        <View style={[styles.platformIndicator, { backgroundColor: notificationContent.color }]}>
          <Text style={styles.platformText}>
            {Platform.OS === 'ios' ? 'DETECTED' : isPremiumUser ? 'BLOCKED' : 'ATTEMPT'}
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 50, // Account for status bar
    paddingHorizontal: 16,
  },
  glowEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  notificationBanner: {
    borderRadius: 16,
    padding: 16,
    minHeight: 80,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  securityIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dismissButton: {
    padding: 4,
  },
  platformIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  platformText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});