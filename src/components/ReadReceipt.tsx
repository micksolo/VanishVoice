import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';

type ReadReceiptStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface ReadReceiptProps {
  status: ReadReceiptStatus;
  textColor: string;
  variant?: 'traditional' | 'neon' | 'eye' | 'lightning';
  size?: number;
}

const getStatusAccessibilityLabel = (status: ReadReceiptStatus): string => {
  switch (status) {
    case 'sending': return 'Message sending';
    case 'sent': return 'Message sent';
    case 'delivered': return 'Message delivered';
    case 'read': return 'Message read';
    case 'failed': return 'Message failed to send';
    default: return 'Message status unknown';
  }
};

export default function ReadReceipt({
  status,
  textColor,
  variant = 'traditional',
  size = 12,
}: ReadReceiptProps) {
  const theme = useAppTheme();
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Log status changes for read receipt debugging
  useEffect(() => {
    console.log('[ReadReceipt] Status changed to:', status, 'at', new Date().toLocaleTimeString());
  }, [status]);

  useEffect(() => {
    if (variant === 'neon' && status === 'read') {
      // Neon glow effect when read
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }

    if (status === 'read') {
      // Subtle scale animation on read
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [status, variant]);

  const getReadColor = () => {
    if (variant === 'neon') {
      return theme.colors.neon?.neonPink || '#FF1B8D'; // Use neon pink for read state per design specs
    }
    // Use proper blue color for read receipts (like WhatsApp/Telegram)
    // Don't use theme.colors.text.accent as it's purple in this app
    const blueColor = '#007AFF'; // iOS blue / WhatsApp blue
    // console.log('[ReadReceipt] Read color:', blueColor, 'for status:', status);
    return blueColor;
  };

  const getDeliveredColor = () => {
    return textColor + '60';
  };

  if (variant === 'traditional') {
    return (
        <Animated.View 
          style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
          accessibilityLabel={getStatusAccessibilityLabel(status)}
          accessibilityRole="text"
        >
        {status === 'sending' && (
          <Ionicons
            name="time-outline"
            size={size}
            color={textColor + '60'}
          />
        )}
        {status === 'sent' && (
          <Ionicons
            name="checkmark"
            size={size}
            color={textColor + '60'}
          />
        )}
        {status === 'delivered' && (
          <View style={styles.doubleCheck}>
            <Ionicons
              name="checkmark"
              size={size}
              color={getDeliveredColor()}
              style={styles.firstCheck}
            />
            <Ionicons
              name="checkmark"
              size={size}
              color={getDeliveredColor()}
              style={styles.secondCheck}
            />
          </View>
        )}
        {status === 'read' && (
          <View style={styles.doubleCheck}>
            <Ionicons
              name="checkmark"
              size={size}
              color={getReadColor()}
              style={styles.firstCheck}
            />
            <Ionicons
              name="checkmark"
              size={size}
              color={getReadColor()}
              style={styles.secondCheck}
            />
          </View>
        )}
        {status === 'failed' && (
          <Ionicons
            name="alert-circle-outline"
            size={size}
            color={theme.colors.text.error || '#ff3b30'}
          />
        )}
        </Animated.View>
    );
  }

  if (variant === 'neon') {
    return (
      <Animated.View 
        style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
        accessibilityLabel={getStatusAccessibilityLabel(status)}
        accessibilityRole="text"
      >
        {status === 'sending' && (
          <View style={styles.neonContainer}>
            <Ionicons
              name="time-outline"
              size={size}
              color={textColor + '60'}
            />
          </View>
        )}
        {status === 'sent' && (
          <View style={styles.neonContainer}>
            <Ionicons
              name="checkmark"
              size={size}
              color={textColor + '60'}
            />
          </View>
        )}
        {status === 'delivered' && (
          <View style={[styles.neonContainer, styles.doubleCheck]}>
            <Ionicons
              name="checkmark"
              size={size}
              color={getDeliveredColor()}
              style={styles.firstCheck}
            />
            <Ionicons
              name="checkmark"
              size={size}
              color={getDeliveredColor()}
              style={styles.secondCheck}
            />
          </View>
        )}
        {status === 'read' && (
          <Animated.View
            style={[
              styles.neonContainer,
              styles.doubleCheck,
              {
                shadowColor: getReadColor(),
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.8],
                }),
                shadowRadius: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [2, 8],
                }),
                elevation: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 8],
                }),
              },
            ]}
          >
            <Ionicons
              name="checkmark"
              size={size}
              color={getReadColor()}
              style={styles.firstCheck}
            />
            <Ionicons
              name="checkmark"
              size={size}
              color={getReadColor()}
              style={styles.secondCheck}
            />
          </Animated.View>
        )}
        {status === 'failed' && (
          <View style={styles.neonContainer}>
            <Ionicons
              name="alert-circle-outline"
              size={size}
              color={theme.colors.text.error || '#ff3b30'}
            />
          </View>
        )}
      </Animated.View>
    );
  }

  if (variant === 'eye') {
    return (
      <Animated.View 
        style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
        accessibilityLabel={getStatusAccessibilityLabel(status)}
        accessibilityRole="text"
      >
        {status === 'sending' && (
          <Ionicons
            name="time-outline"
            size={size}
            color={textColor + '60'}
          />
        )}
        {status === 'sent' && (
          <Ionicons
            name="checkmark"
            size={size}
            color={textColor + '60'}
          />
        )}
        {status === 'delivered' && (
          <Ionicons
            name="eye-outline"
            size={size}
            color={getDeliveredColor()}
          />
        )}
        {status === 'read' && (
          <Ionicons
            name="eye"
            size={size}
            color={getReadColor()}
          />
        )}
        {status === 'failed' && (
          <Ionicons
            name="alert-circle-outline"
            size={size}
            color={theme.colors.text.error || '#ff3b30'}
          />
        )}
      </Animated.View>
    );
  }

  if (variant === 'lightning') {
    return (
      <Animated.View 
        style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
        accessibilityLabel={getStatusAccessibilityLabel(status)}
        accessibilityRole="text"
      >
        {status === 'sending' && (
          <Ionicons
            name="time-outline"
            size={size}
            color={textColor + '60'}
          />
        )}
        {status === 'sent' && (
          <Ionicons
            name="flash-outline"
            size={size}
            color={textColor + '60'}
          />
        )}
        {status === 'delivered' && (
          <Ionicons
            name="flash-outline"
            size={size}
            color={getDeliveredColor()}
          />
        )}
        {status === 'read' && (
          <View style={styles.lightningContainer}>
            <Ionicons
              name="flash"
              size={size}
              color={theme.colors.neon?.cyberBlue || theme.colors.text.accent}
            />
          </View>
        )}
        {status === 'failed' && (
          <Ionicons
            name="alert-circle-outline"
            size={size}
            color={theme.colors.text.error || '#ff3b30'}
          />
        )}
      </Animated.View>
    );
  }

  // Default fallback
  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doubleCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 18, // Fixed width to prevent layout shifts
  },
  firstCheck: {
    marginLeft: -2, // Position for first checkmark
    zIndex: 1,
  },
  secondCheck: {
    marginLeft: -7, // Moderate overlap for WhatsApp-style spacing (was -12 which fully overlapped)
    zIndex: 2, // Second check appears on top
  },
  neonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lightningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugText: {
    marginRight: 4,
    fontSize: 8,
    opacity: 0.6,
  },
});