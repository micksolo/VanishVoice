import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSecurity } from '../contexts/SecurityContext';

interface SecurityShieldProps {
  isActive?: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onPress?: () => void;
  messageType?: 'text' | 'voice' | 'video';
  style?: any;
}

const SIZES = {
  small: 16,
  medium: 20,
  large: 24,
};

export default function SecurityShield({
  isActive = true,
  size = 'small',
  showLabel = false,
  onPress,
  messageType,
  style,
}: SecurityShieldProps) {
  const theme = useAppTheme();
  const { isPremiumUser, canPreventScreenshots, canDetectScreenshots } = useSecurity();
  
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const iconSize = SIZES[size];
  
  // Determine security level based on platform and premium status
  const getSecurityLevel = () => {
    if (!isActive) return 'inactive';
    
    if (Platform.OS === 'android' && isPremiumUser) {
      return 'full'; // Full screenshot prevention
    } else if (Platform.OS === 'ios' && isPremiumUser) {
      return 'enhanced'; // Detection + blur protection
    } else if (canDetectScreenshots) {
      return 'basic'; // Detection only
    } else {
      return 'limited'; // No security features available
    }
  };
  
  const securityLevel = getSecurityLevel();
  
  // Get appropriate icon based on security level
  const getIconName = () => {
    switch (securityLevel) {
      case 'full':
        return 'shield-checkmark'; // Full protection
      case 'enhanced':
        return 'shield'; // Enhanced protection
      case 'basic':
        return 'eye'; // Detection only
      case 'limited':
      case 'inactive':
        return 'shield-outline'; // Limited/no protection
      default:
        return 'shield-outline';
    }
  };
  
  // Get color based on security level
  const getColor = () => {
    if (!isActive) {
      return theme.colors.text.disabled;
    }
    
    switch (securityLevel) {
      case 'full':
        return theme.colors.neon?.cyberBlue || '#00D9FF'; // Cyber blue for full protection
      case 'enhanced':
        return theme.colors.neon?.electricPurple || '#B026FF'; // Purple for enhanced
      case 'basic':
        return theme.colors.neon?.neonPink || '#FF1B8D'; // Pink for basic detection
      case 'limited':
        return theme.colors.text.tertiary;
      default:
        return theme.colors.text.disabled;
    }
  };
  
  // Get label text based on security level
  const getLabelText = () => {
    switch (securityLevel) {
      case 'full':
        return 'Screenshots Blocked';
      case 'enhanced':
        return 'Protected';
      case 'basic':
        return 'Screenshots Detected';
      case 'limited':
        return 'Limited Protection';
      case 'inactive':
        return 'Protection Off';
      default:
        return '';
    }
  };
  
  // Glow animation for active security
  useEffect(() => {
    if (isActive && (securityLevel === 'full' || securityLevel === 'enhanced')) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [isActive, securityLevel]);
  
  // Press animation
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };
  
  const shieldColor = getColor();
  const iconName = getIconName();
  const labelText = getLabelText();
  
  // Calculate glow opacity based on animation
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });
  
  const ShieldContent = (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      {/* Glow effect for premium security */}
      {(securityLevel === 'full' || securityLevel === 'enhanced') && (
        <Animated.View
          style={[
            styles.glowEffect,
            {
              backgroundColor: shieldColor,
              opacity: glowOpacity,
              width: iconSize * 2,
              height: iconSize * 2,
              borderRadius: iconSize,
            },
          ]}
        />
      )}
      
      {/* Shield icon */}
      <View style={styles.iconContainer}>
        <Ionicons
          name={iconName as any}
          size={iconSize}
          color={shieldColor}
        />
        
        {/* Premium badge */}
        {isPremiumUser && size !== 'small' && (
          <View style={[styles.premiumBadge, { backgroundColor: theme.colors.neon?.laserGreen || '#00FF88' }]}>
            <Text style={styles.premiumText}>PRO</Text>
          </View>
        )}
      </View>
      
      {/* Label text */}
      {showLabel && (
        <Text
          style={[
            styles.label,
            theme.typography.labelSmall,
            { color: shieldColor },
          ]}
        >
          {labelText}
        </Text>
      )}
    </Animated.View>
  );
  
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        accessibilityLabel={`Security: ${labelText}`}
        accessibilityRole="button"
        accessibilityHint="Tap to learn more about screenshot protection"
      >
        {ShieldContent}
      </TouchableOpacity>
    );
  }
  
  return ShieldContent;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  iconContainer: {
    position: 'relative',
  },
  glowEffect: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -16,
    marginTop: -16,
    zIndex: -1,
  },
  premiumBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  premiumText: {
    fontSize: 6,
    fontWeight: 'bold',
    color: '#000',
  },
  label: {
    marginLeft: 4,
    fontSize: 10,
  },
});