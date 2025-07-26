import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAppTheme } from '../contexts/ThemeContext';
import WaveformVisualizer from './WaveformVisualizer';

interface VoiceMessagePlayerProps {
  audioUri: string;
  duration?: number; // in seconds
  isEphemeral?: boolean;
  onPlayStart?: () => void;
  onPlayComplete?: () => void;
  style?: ViewStyle;
  showWaveform?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function VoiceMessagePlayer({
  audioUri,
  duration = 0,
  isEphemeral = false,
  onPlayStart,
  onPlayComplete,
  style,
  showWaveform = true,
  size = 'medium',
}: VoiceMessagePlayerProps) {
  const theme = useAppTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [actualDuration, setActualDuration] = useState(duration);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    if (isPlaying) {
      // Pulse animation for playing state
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying]);

  const loadAndPlaySound = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
      onPlayStart?.();
    } catch (error) {
      console.error('Error loading sound:', error);
    }
  };

  const pauseSound = async () => {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  };

  const stopSound = async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
      setPosition(0);
      progressAnim.setValue(0);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      if (status.durationMillis) {
        setActualDuration(Math.floor(status.durationMillis / 1000));
      }
      
      if (status.positionMillis) {
        const currentPosition = Math.floor(status.positionMillis / 1000);
        setPosition(currentPosition);
        
        // Update progress animation
        const progress = status.durationMillis 
          ? status.positionMillis / status.durationMillis 
          : 0;
        progressAnim.setValue(progress);
      }

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        progressAnim.setValue(0);
        onPlayComplete?.();
      }
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      pauseSound();
    } else {
      loadAndPlaySound();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          buttonSize: 32,
          iconSize: 16,
          fontSize: theme.typography.bodySmall.fontSize,
        };
      case 'large':
        return {
          buttonSize: 56,
          iconSize: 28,
          fontSize: theme.typography.bodyLarge.fontSize,
        };
      default:
        return {
          buttonSize: 44,
          iconSize: 22,
          fontSize: theme.typography.bodyMedium.fontSize,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View style={[styles.container, style]}>
      {/* Play/Pause Button */}
      <Animated.View
        style={{
          transform: [{ scale: pulseAnim }],
        }}
      >
        <TouchableOpacity
          style={[
            styles.playButton,
            {
              width: sizeStyles.buttonSize,
              height: sizeStyles.buttonSize,
              borderRadius: sizeStyles.buttonSize / 2,
              backgroundColor: isEphemeral
                ? theme.colors.text.accent
                : theme.colors.button.primary.background,
              ...theme.shadows.small,
            },
          ]}
          onPress={togglePlayback}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={sizeStyles.iconSize}
            color={theme.colors.text.inverse}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Waveform and Progress */}
      <View style={styles.progressContainer}>
        {showWaveform && (
          <View style={styles.waveformContainer}>
            <WaveformVisualizer
              isActive={isPlaying}
              amplitude={0.7}
              barCount={15}
              maxHeight={size === 'small' ? 20 : size === 'large' ? 32 : 24}
              style={styles.waveform}
            />
            
            {/* Progress overlay */}
            <Animated.View
              style={[
                styles.progressOverlay,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        )}

        {/* Time Display */}
        <View style={styles.timeContainer}>
          <Text
            style={[
              styles.timeText,
              {
                fontSize: sizeStyles.fontSize,
                color: theme.colors.text.primary,
              },
            ]}
          >
            {formatTime(position)}
          </Text>
          <Text
            style={[
              styles.durationText,
              {
                fontSize: sizeStyles.fontSize * 0.85,
                color: theme.colors.text.secondary,
              },
            ]}
          >
            / {formatTime(actualDuration)}
          </Text>
        </View>

        {/* Ephemeral indicator */}
        {isEphemeral && (
          <View style={styles.ephemeralIndicator}>
            <Ionicons
              name="timer-outline"
              size={12}
              color={theme.colors.text.accent}
            />
            <Text
              style={[
                styles.ephemeralText,
                theme.typography.labelSmall,
                { color: theme.colors.text.accent },
              ]}
            >
              Ephemeral
            </Text>
          </View>
        )}
      </View>

      {/* Stop button for longer messages */}
      {actualDuration > 30 && isPlaying && (
        <TouchableOpacity
          style={[
            styles.stopButton,
            {
              backgroundColor: theme.colors.text.tertiary + '40',
            },
          ]}
          onPress={stopSound}
        >
          <Ionicons
            name="stop"
            size={16}
            color={theme.colors.text.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  playButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  progressContainer: {
    flex: 1,
  },
  waveformContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  waveform: {
    height: 24,
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  timeText: {
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  durationText: {
    fontVariant: ['tabular-nums'],
  },
  ephemeralIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  ephemeralText: {
  },
  stopButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});