import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAppTheme } from '../contexts/ThemeContext';

interface IntegratedCountdownProps {
  duration: number; // in seconds
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  onExpire?: () => void;
  color?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function IntegratedCountdown({
  duration,
  size = 24,
  strokeWidth = 2,
  showText = true,
  onExpire,
  color,
}: IntegratedCountdownProps) {
  const theme = useAppTheme();
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeColor = color || theme.colors.ephemeral?.countdown || theme.colors.text.accent;

  useEffect(() => {
    // Start countdown animation
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: duration * 1000,
      useNativeDriver: true,
    }).start(() => {
      onExpire?.();
    });

    // Pulse animation when time is running out
    const startPulse = setTimeout(() => {
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
    }, (duration - 10) * 1000); // Start pulsing in last 10 seconds

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
      clearTimeout(startPulse);
    };
  }, [duration]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getColor = () => {
    if (timeRemaining <= 10) return theme.colors.ephemeral?.danger || theme.colors.status.error;
    if (timeRemaining <= 30) return theme.colors.ephemeral?.warning || theme.colors.status.warning;
    return strokeColor;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.border.subtle}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.3}
        />
        
        {/* Animated progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, circumference],
          })}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.timeText, { color: getColor() }]}>
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
  },
  svg: {
    transform: [{ rotateZ: '0deg' }],
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