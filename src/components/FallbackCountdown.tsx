import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface FallbackCountdownProps {
  duration: number; // in seconds
  size?: number;
  showText?: boolean;
  onExpire?: () => void;
  color?: string;
}

export default function FallbackCountdown({
  duration,
  size = 24,
  showText = true,
  onExpire,
  color,
}: FallbackCountdownProps) {
  const theme = useAppTheme();
  const safeDuration = Math.max(0, Math.floor(duration || 0));
  const [timeRemaining, setTimeRemaining] = useState(safeDuration);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const strokeColor = color || theme.colors.ephemeral?.countdown || theme.colors.text.accent;

  useEffect(() => {
    if (!safeDuration || safeDuration <= 0) {
      console.warn('[FallbackCountdown] Invalid duration:', duration);
      onExpire?.();
      return;
    }

    // Progress animation
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: safeDuration * 1000,
      useNativeDriver: false, // Width changes require layout animations
    }).start(() => {
      onExpire?.();
    });

    // Pulse animation when time is running out
    let startPulse: NodeJS.Timeout | null = null;
    if (safeDuration > 10) {
      startPulse = setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.2,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }, (safeDuration - 10) * 1000);
    }

    // Update time remaining
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = Math.max(0, prev - 1);
        if (newTime === 0) {
          clearInterval(interval);
        }
        return newTime;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      if (startPulse) {
        clearTimeout(startPulse);
      }
    };
  }, [safeDuration, progressAnim, pulseAnim, onExpire]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentColor = () => {
    if (timeRemaining <= 10) return theme.colors.ephemeral?.danger || theme.colors.status.error;
    if (timeRemaining <= 30) return theme.colors.ephemeral?.warning || theme.colors.status.warning;
    return strokeColor;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, size - 4], // Account for border width
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      {/* Circular background */}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: theme.colors.border.subtle,
            borderWidth: 2,
          },
        ]}
      />
      
      {/* Progress bar (horizontal) */}
      <View
        style={[
          styles.progressContainer,
          {
            width: size - 4,
            height: 2,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressWidth,
              backgroundColor: getCurrentColor(),
            },
          ]}
        />
      </View>

      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.timeText, { color: getCurrentColor() }]}>
            {formatTime(timeRemaining)}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  circle: {
    position: 'absolute',
    opacity: 0.3,
  },
  progressContainer: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 8,
    fontWeight: '600',
  },
});