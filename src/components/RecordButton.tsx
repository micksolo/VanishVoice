import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';

interface RecordButtonProps {
  onPressIn: (event: GestureResponderEvent) => void;
  onPressOut: (event: GestureResponderEvent) => void;
  isRecording: boolean;
  size?: number;
  style?: ViewStyle;
}

export default function RecordButton({
  onPressIn,
  onPressOut,
  isRecording,
  size = 140,
  style,
}: RecordButtonProps) {
  const theme = useAppTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Fade in the outer ring
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Rotate animation for ephemeral feel
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      // Reset animations
      pulseAnim.setValue(1);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      rotateAnim.setValue(0);
    }
  }, [isRecording]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, style]}>
      {/* Outer ephemeral rings */}
      <Animated.View
        style={[
          styles.outerRing,
          {
            width: size + 40,
            height: size + 40,
            borderRadius: (size + 40) / 2,
            borderColor: theme.colors.recording.active,
            opacity: fadeAnim,
            transform: [{ scale: pulseAnim }, { rotate: rotateInterpolate }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.middleRing,
          {
            width: size + 20,
            height: size + 20,
            borderRadius: (size + 20) / 2,
            borderColor: theme.colors.recording.active,
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.5],
            }),
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Main button */}
      <TouchableOpacity
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isRecording
              ? theme.colors.recording.active
              : theme.colors.background.elevated,
            ...theme.shadows.large,
          },
        ]}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.8}
      >
        <Animated.View
          style={{
            transform: [
              {
                scale: isRecording
                  ? pulseAnim.interpolate({
                      inputRange: [1, 1.15],
                      outputRange: [1, 0.95],
                    })
                  : 1,
              },
            ],
          }}
        >
          <Ionicons
            name="mic"
            size={size * 0.4}
            color={isRecording ? theme.colors.text.inverse : theme.colors.text.primary}
          />
        </Animated.View>

        {/* Inner glow effect when recording */}
        {isRecording && (
          <Animated.View
            style={[
              styles.innerGlow,
              {
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.15],
                  outputRange: [0.3, 0.6],
                }),
              },
            ]}
          />
        )}
      </TouchableOpacity>

      {/* Ephemeral particles effect */}
      {isRecording && (
        <>
          <Animated.View
            style={[
              styles.particle,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.3],
                }),
                transform: [
                  {
                    translateY: pulseAnim.interpolate({
                      inputRange: [1, 1.15],
                      outputRange: [0, -10],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.particle,
              styles.particleRight,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.3],
                }),
                transform: [
                  {
                    translateX: pulseAnim.interpolate({
                      inputRange: [1, 1.15],
                      outputRange: [0, 10],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.particle,
              styles.particleBottom,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.3],
                }),
                transform: [
                  {
                    translateY: pulseAnim.interpolate({
                      inputRange: [1, 1.15],
                      outputRange: [0, 10],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.particle,
              styles.particleLeft,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.3],
                }),
                transform: [
                  {
                    translateX: pulseAnim.interpolate({
                      inputRange: [1, 1.15],
                      outputRange: [0, -10],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  middleRing: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'solid',
  },
  innerGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4ECDC4',
  },
  particleRight: {
    right: '15%',
    top: '50%',
  },
  particleBottom: {
    bottom: '15%',
    left: '50%',
  },
  particleLeft: {
    left: '15%',
    top: '50%',
  },
});