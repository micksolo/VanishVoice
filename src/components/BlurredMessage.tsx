import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';

interface BlurredMessageProps {
  content: string;
  onReveal?: () => void;
  autoRevealDelay?: number;
  messageType?: 'text' | 'voice' | 'video';
}

export default function BlurredMessage({
  content,
  onReveal,
  autoRevealDelay,
  messageType = 'text',
}: BlurredMessageProps) {
  const theme = useAppTheme();
  const [isRevealed, setIsRevealed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Glow pulse animation
  React.useEffect(() => {
    if (!isRevealed) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isRevealed]);

  // Auto-reveal timer
  React.useEffect(() => {
    if (autoRevealDelay && !isRevealed) {
      const timer = setTimeout(() => {
        handleReveal();
      }, autoRevealDelay);
      return () => clearTimeout(timer);
    }
  }, [autoRevealDelay, isRevealed]);

  const handleReveal = () => {
    if (isRevealed) return;

    setIsRevealed(true);
    
    // Reveal animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    onReveal?.();
  };

  const getIcon = () => {
    switch (messageType) {
      case 'voice':
        return 'mic';
      case 'video':
        return 'videocam';
      default:
        return 'lock-closed';
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handleReveal}
      disabled={isRevealed}
    >
      <View style={styles.container}>
        {/* Glow effect background */}
        {!isRevealed && (
          <Animated.View
            style={[
              styles.glowBackground,
              {
                backgroundColor: theme.colors.ephemeral?.glow || theme.colors.text.accent,
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.25],
                }),
                transform: [{
                  scale: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.05],
                  }),
                }],
              },
            ]}
          />
        )}

        {/* Blurred content layers (fake blur effect) */}
        {!isRevealed && (
          <View style={styles.blurContainer}>
            {/* Multiple offset text layers for blur effect */}
            {[...Array(5)].map((_, i) => (
              <Text
                key={i}
                style={[
                  styles.blurredText,
                  {
                    color: theme.colors.text.tertiary,
                    opacity: 0.15 - (i * 0.02),
                    transform: [
                      { translateX: (i - 2) * 1.5 },
                      { translateY: (i - 2) * 0.5 },
                    ],
                  },
                ]}
                numberOfLines={3}
              >
                {content}
              </Text>
            ))}

            {/* Lock icon overlay */}
            <View style={styles.lockOverlay}>
              <Ionicons
                name={getIcon()}
                size={24}
                color={theme.colors.ephemeral?.glow || theme.colors.text.accent}
              />
              <Text style={[styles.tapText, { color: theme.colors.text.secondary }]}>
                Tap to reveal
              </Text>
            </View>
          </View>
        )}

        {/* Revealed content */}
        <Animated.View
          style={[
            styles.revealedContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          pointerEvents={isRevealed ? 'auto' : 'none'}
        >
          <Text style={[styles.revealedText, { color: theme.colors.text.primary }]}>
            {content}
          </Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    minHeight: 60,
    justifyContent: 'center',
  },
  glowBackground: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 20,
  },
  blurContainer: {
    position: 'relative',
    padding: 12,
    minHeight: 60,
    justifyContent: 'center',
  },
  blurredText: {
    position: 'absolute',
    left: 12,
    right: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  lockOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tapText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  revealedContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    justifyContent: 'center',
  },
  revealedText: {
    fontSize: 14,
    lineHeight: 20,
  },
});