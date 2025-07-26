import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';

interface CountdownTimerProps {
  duration: number; // in seconds
  onExpire?: () => void;
  style?: ViewStyle;
  showIcon?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function CountdownTimer({
  duration,
  onExpire,
  style,
  showIcon = true,
  size = 'medium',
}: CountdownTimerProps) {
  const theme = useAppTheme();
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpire?.();
          // Fade out animation when expired
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 0.8,
              duration: 500,
              useNativeDriver: true,
            }),
          ]).start();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Rotating animation for urgency
    if (timeRemaining < 60) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    }

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getColor = () => {
    if (timeRemaining === 0) return theme.colors.text.disabled;
    if (timeRemaining < 60) return theme.colors.status.error;
    if (timeRemaining < 300) return theme.colors.status.warning;
    return theme.colors.text.accent;
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          fontSize: theme.typography.bodySmall.fontSize,
          iconSize: 12,
          padding: 4,
        };
      case 'large':
        return {
          fontSize: theme.typography.headlineMedium.fontSize,
          iconSize: 20,
          padding: 12,
        };
      default:
        return {
          fontSize: theme.typography.bodyMedium.fontSize,
          iconSize: 16,
          padding: 8,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { rotate: timeRemaining < 60 ? rotateInterpolate : '0deg' },
          ],
          backgroundColor: getColor() + '20',
          paddingHorizontal: sizeStyles.padding,
          paddingVertical: sizeStyles.padding / 2,
        },
        style,
      ]}
    >
      {showIcon && (
        <Ionicons
          name={timeRemaining === 0 ? 'time' : 'timer-outline'}
          size={sizeStyles.iconSize}
          color={getColor()}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.text,
          {
            fontSize: sizeStyles.fontSize,
            color: getColor(),
            fontWeight: timeRemaining < 60 ? '700' : '600',
          },
        ]}
      >
        {formatTime(timeRemaining)}
      </Text>
      
      {/* Ephemeral effect - disappearing dots */}
      {timeRemaining > 0 && timeRemaining < 10 && (
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: getColor(),
                  opacity: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, (3 - index) / 3],
                  }),
                },
              ]}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontVariant: ['tabular-nums'],
  },
  dotsContainer: {
    flexDirection: 'row',
    marginLeft: 4,
    gap: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});