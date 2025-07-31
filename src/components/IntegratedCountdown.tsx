import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import FallbackCountdown from './FallbackCountdown';

// Conditional import for SVG components
let Svg: any, Circle: any, AnimatedCircle: any;
let svgAvailable = false;

try {
  const SvgModule = require('react-native-svg');
  Svg = SvgModule.default || SvgModule.Svg;
  Circle = SvgModule.Circle;
  AnimatedCircle = Animated.createAnimatedComponent(Circle);
  svgAvailable = true;
} catch (error) {
  console.warn('[IntegratedCountdown] SVG not available, using fallback:', error.message);
  svgAvailable = false;
}

interface IntegratedCountdownProps {
  duration: number; // in seconds
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
  onExpire?: () => void;
  color?: string;
}

export default function IntegratedCountdown({
  duration,
  size = 24,
  strokeWidth = 2,
  showText = true,
  onExpire,
  color,
}: IntegratedCountdownProps) {
  // If SVG is not available, use fallback component
  if (!svgAvailable) {
    return (
      <FallbackCountdown
        duration={duration}
        size={size}
        showText={showText}
        onExpire={onExpire}
        color={color}
      />
    );
  }

  const theme = useAppTheme();
  // Ensure duration is a valid number
  const safeDuration = Math.max(0, Math.floor(duration || 0));
  const [timeRemaining, setTimeRemaining] = useState(safeDuration);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeColor = color || theme.colors.ephemeral?.countdown || theme.colors.text.accent;
  
  // Create stable animated value for stroke dash offset
  const strokeDashOffset = useMemo(
    () => animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, circumference],
    }),
    [animatedValue, circumference]
  );

  useEffect(() => {
    // Early return if duration is invalid
    if (!safeDuration || safeDuration <= 0) {
      console.warn('[IntegratedCountdown] Invalid duration:', duration);
      onExpire?.();
      return;
    }

    // Start countdown animation
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: safeDuration * 1000,
      useNativeDriver: true,
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
      }, (safeDuration - 10) * 1000); // Start pulsing in last 10 seconds
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
  }, [safeDuration, animatedValue, pulseAnim, onExpire]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Memoize the color to prevent recalculation during render
  const currentColor = useMemo(() => {
    if (timeRemaining <= 10) return theme.colors.ephemeral?.danger || theme.colors.status.error;
    if (timeRemaining <= 30) return theme.colors.ephemeral?.warning || theme.colors.status.warning;
    return strokeColor;
  }, [timeRemaining, strokeColor, theme.colors.ephemeral, theme.colors.status]);

  // Wrap SVG rendering in try-catch for runtime errors
  try {
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
            stroke={currentColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>

        {showText && (
          <View style={styles.textContainer}>
            <Text style={[styles.timeText, { color: currentColor }]}>
              {formatTime(timeRemaining)}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  } catch (error) {
    console.warn('[IntegratedCountdown] SVG render error, using fallback:', error.message);
    return (
      <FallbackCountdown
        duration={duration}
        size={size}
        showText={showText}
        onExpire={onExpire}
        color={color}
      />
    );
  }
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