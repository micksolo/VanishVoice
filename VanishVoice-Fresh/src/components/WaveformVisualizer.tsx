import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface WaveformVisualizerProps {
  isActive: boolean;
  amplitude?: number; // 0-1
  style?: ViewStyle;
  barCount?: number;
  barWidth?: number;
  maxHeight?: number;
}

export default function WaveformVisualizer({
  isActive,
  amplitude = 0.5,
  style,
  barCount = 25,
  barWidth = 3,
  maxHeight = 40,
}: WaveformVisualizerProps) {
  const theme = useAppTheme();
  const animations = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (isActive) {
      // Animate bars with different delays for wave effect
      animations.forEach((anim, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * amplitude + 0.2,
              duration: 300 + Math.random() * 200,
              delay: index * 30,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 300 + Math.random() * 200,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    } else {
      // Reset all bars
      animations.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [isActive, amplitude]);

  return (
    <View style={[styles.container, style]}>
      {animations.map((anim, index) => {
        // Create a more natural waveform pattern
        const centerIndex = Math.floor(barCount / 2);
        const distanceFromCenter = Math.abs(index - centerIndex);
        const heightMultiplier = 1 - (distanceFromCenter / centerIndex) * 0.5;

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                width: barWidth,
                backgroundColor: isActive
                  ? theme.colors.recording.active
                  : theme.colors.text.disabled,
                opacity: isActive ? 1 : 0.5,
                transform: [
                  {
                    scaleY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, heightMultiplier],
                    }),
                  },
                ],
                height: maxHeight,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bar: {
    borderRadius: 2,
  },
});