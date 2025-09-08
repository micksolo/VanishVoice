import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSecurity } from '../contexts/SecurityContext';

interface SecurityTrustScoreProps {
  screenshotAttempts?: number;
  messageId?: string;
  messageType?: 'voice' | 'video' | 'text';
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
  variant?: 'badge' | 'inline' | 'header';
}

export default function SecurityTrustScore({
  screenshotAttempts = 0,
  messageId,
  messageType,
  showLabel = true,
  size = 'medium',
  onPress,
  variant = 'badge',
}: SecurityTrustScoreProps) {
  const theme = useAppTheme();
  const { isPremiumUser, canPreventScreenshots, canDetectScreenshots } = useSecurity();
  
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (screenshotAttempts > 0) {
      // Pulse animation for security events
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [screenshotAttempts]);

  const getTrustLevel = () => {
    if (screenshotAttempts === 0) {
      return {
        level: 'secure',
        color: theme.colors.neon?.cyberBlue || '#00D9FF',
        icon: 'shield-checkmark',
        label: 'Secure',
        description: 'No screenshot attempts',
      };
    } else if (screenshotAttempts <= 2) {
      return {
        level: 'monitored',
        color: theme.colors.neon?.neonPink || '#FF1B8D',
        icon: 'eye',
        label: 'Monitored',
        description: `${screenshotAttempts} screenshot${screenshotAttempts > 1 ? 's' : ''} detected`,
      };
    } else {
      return {
        level: 'compromised',
        color: theme.colors.status.error,
        icon: 'warning',
        label: 'Compromised',
        description: `${screenshotAttempts} screenshots taken`,
      };
    }
  };

  const getProtectionStatus = () => {
    if (Platform.OS === 'android' && isPremiumUser) {
      return {
        status: 'protected',
        text: 'Screenshots Blocked',
        color: theme.colors.neon?.cyberBlue || '#00D9FF',
      };
    } else if (Platform.OS === 'ios' && canDetectScreenshots) {
      return {
        status: 'detected',
        text: 'Screenshots Detected',
        color: theme.colors.neon?.neonPink || '#FF1B8D',
      };
    } else {
      return {
        status: 'limited',
        text: 'Limited Protection',
        color: theme.colors.text.tertiary,
      };
    }
  };

  const trustInfo = getTrustLevel();
  const protectionInfo = getProtectionStatus();

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getSizeProps = () => {
    switch (size) {
      case 'small':
        return { iconSize: 16, fontSize: 12, padding: 6 };
      case 'large':
        return { iconSize: 24, fontSize: 16, padding: 12 };
      default:
        return { iconSize: 20, fontSize: 14, padding: 8 };
    }
  };

  const sizeProps = getSizeProps();

  const renderBadgeVariant = () => (
    <Animated.View
      style={[
        styles.badgeContainer,
        {
          backgroundColor: theme.colors.background.secondary,
          borderColor: trustInfo.color,
          padding: sizeProps.padding,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Security pulse effect */}
      {screenshotAttempts > 0 && (
        <Animated.View
          style={[
            styles.pulseEffect,
            {
              backgroundColor: trustInfo.color,
              opacity: pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1, 0.3],
              }),
            },
          ]}
        />
      )}

      <View style={styles.badgeContent}>
        <Ionicons
          name={trustInfo.icon as any}
          size={sizeProps.iconSize}
          color={trustInfo.color}
        />
        
        {showLabel && (
          <View style={styles.textContent}>
            <Text
              style={[
                styles.trustLabel,
                {
                  color: theme.colors.text.primary,
                  fontSize: sizeProps.fontSize,
                },
              ]}
            >
              {trustInfo.label}
            </Text>
            
            {screenshotAttempts > 0 && (
              <Text
                style={[
                  styles.attemptCount,
                  {
                    color: trustInfo.color,
                    fontSize: sizeProps.fontSize - 2,
                  },
                ]}
              >
                {trustInfo.description}
              </Text>
            )}
          </View>
        )}

        {screenshotAttempts > 0 && (
          <View style={[styles.countBadge, { backgroundColor: trustInfo.color }]}>
            <Text style={styles.countText}>{screenshotAttempts}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderInlineVariant = () => (
    <View style={styles.inlineContainer}>
      <Ionicons
        name={trustInfo.icon as any}
        size={sizeProps.iconSize}
        color={trustInfo.color}
      />
      
      {showLabel && (
        <Text
          style={[
            styles.inlineLabel,
            {
              color: theme.colors.text.secondary,
              fontSize: sizeProps.fontSize,
              marginLeft: 4,
            },
          ]}
        >
          {trustInfo.description}
        </Text>
      )}

      {screenshotAttempts > 0 && (
        <View style={[styles.smallCountBadge, { backgroundColor: trustInfo.color }]}>
          <Text style={styles.smallCountText}>{screenshotAttempts}</Text>
        </View>
      )}
    </View>
  );

  const renderHeaderVariant = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Ionicons
            name={protectionInfo.status === 'protected' ? 'shield-checkmark' : 'eye'}
            size={20}
            color={protectionInfo.color}
          />
        </View>
        
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
            {protectionInfo.text}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.text.secondary }]}>
            {Platform.OS === 'ios' ? 'Detection Active' : isPremiumUser ? 'Pro Protection' : 'Basic Mode'}
          </Text>
        </View>

        {screenshotAttempts > 0 && (
          <View style={styles.headerBadge}>
            <View style={[styles.countBadge, { backgroundColor: trustInfo.color }]}>
              <Text style={styles.countText}>{screenshotAttempts}</Text>
            </View>
            <Text style={[styles.headerAttempts, { color: trustInfo.color }]}>
              screenshot{screenshotAttempts > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderVariant = () => {
    switch (variant) {
      case 'inline':
        return renderInlineVariant();
      case 'header':
        return renderHeaderVariant();
      default:
        return renderBadgeVariant();
    }
  };

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={styles.container}
      onPress={onPress}
      onPressIn={onPress ? handlePressIn : undefined}
      onPressOut={onPress ? handlePressOut : undefined}
      activeOpacity={0.7}
      accessibilityLabel={`Security status: ${trustInfo.label}. ${trustInfo.description}`}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      {renderVariant()}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  badgeContainer: {
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  pulseEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textContent: {
    flex: 1,
  },
  trustLabel: {
    fontWeight: '600',
  },
  attemptCount: {
    fontWeight: '500',
    marginTop: 1,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineLabel: {
    fontWeight: '500',
  },
  smallCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    marginLeft: 4,
  },
  smallCountText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  headerContainer: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  headerBadge: {
    alignItems: 'center',
  },
  headerAttempts: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
});