import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { ExpiryRule } from '../types/database';
import IntegratedCountdown from './IntegratedCountdown';
import BlurredMessage from './BlurredMessage';
import VanishAnimation, { VanishAnimationRef } from './VanishAnimation';

interface EphemeralMessageBubbleProps {
  content?: string;
  isMine: boolean;
  timestamp: Date;
  expiryRule?: ExpiryRule;
  isEphemeral?: boolean;
  hasBeenViewed?: boolean;
  isExpired?: boolean;
  onPress?: () => void;
  onExpire?: () => void;
  style?: ViewStyle;
  messageType?: 'text' | 'voice' | 'video' | 'image';
  blurBeforeView?: boolean;
}

export default function EphemeralMessageBubble({
  content,
  isMine,
  timestamp,
  expiryRule,
  isEphemeral = false,
  hasBeenViewed = false,
  isExpired = false,
  onPress,
  onExpire,
  style,
  messageType = 'text',
  blurBeforeView = true,
}: EphemeralMessageBubbleProps) {
  const theme = useAppTheme();
  const vanishRef = useRef<VanishAnimationRef>(null);
  const [isRevealed, setIsRevealed] = useState(!blurBeforeView || hasBeenViewed);
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Glow effect for ephemeral messages
  useEffect(() => {
    if (isEphemeral && !hasBeenViewed && !isExpired) {
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
  }, [isEphemeral, hasBeenViewed, isExpired]);

  const handleReveal = () => {
    setIsRevealed(true);
    onPress?.();
  };

  const handleExpire = () => {
    // Trigger vanish animation
    vanishRef.current?.vanish();
    // Call expiry callback after animation
    setTimeout(() => {
      onExpire?.();
    }, 800);
  };

  const getBubbleColor = () => {
    if (isExpired) {
      return theme.colors.text.disabled + '40';
    }
    
    if (isMine) {
      return theme.isDark 
        ? theme.colors.ephemeral?.glowIntense || theme.colors.chat.sent
        : theme.colors.chat.sent;
    } else {
      return theme.colors.chat.received;
    }
  };

  const getTextColor = () => {
    if (isExpired) {
      return theme.colors.text.disabled;
    }
    
    return isMine 
      ? theme.colors.chat.sentText 
      : theme.colors.chat.receivedText;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getVanishType = () => {
    if (expiryRule?.type === 'view') return 'particles';
    if (expiryRule?.type === 'time') return 'dissolve';
    return 'fade';
  };

  return (
    <VanishAnimation
      ref={vanishRef}
      type={getVanishType()}
      duration={800}
      onComplete={() => onExpire?.()}
    >
      <View
        style={[
          styles.container,
          {
            alignSelf: isMine ? 'flex-end' : 'flex-start',
          },
          style,
        ]}
      >
        {/* Glow effect layer */}
        {isEphemeral && !hasBeenViewed && !isExpired && (
          <Animated.View
            style={[
              styles.glowLayer,
              {
                backgroundColor: theme.colors.ephemeral?.glow || theme.colors.text.accent,
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.2],
                }),
                transform: [{
                  scale: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                }],
              },
            ]}
          />
        )}

        <TouchableOpacity
          style={[
            styles.bubble,
            {
              backgroundColor: getBubbleColor(),
              borderBottomRightRadius: isMine ? 8 : 18,
              borderBottomLeftRadius: isMine ? 18 : 8,
              marginLeft: isMine ? 50 : 0,
              marginRight: isMine ? 0 : 50,
            },
          ]}
          onPress={handleReveal}
          activeOpacity={0.8}
          disabled={isExpired || (isRevealed && !onPress)}
        >
          {/* Message content - blur if not revealed */}
          {!isRevealed && blurBeforeView ? (
            <BlurredMessage
              content={content || ''}
              onReveal={handleReveal}
              messageType={messageType}
            />
          ) : (
            <>
              {/* Message type icon for non-text */}
              {messageType !== 'text' && (
                <View style={styles.messageTypeRow}>
                  <Ionicons
                    name={messageType === 'voice' ? 'mic' : messageType === 'video' ? 'videocam' : 'image'}
                    size={16}
                    color={getTextColor()}
                  />
                  <Text style={[styles.messageTypeText, { color: getTextColor() }]}>
                    {messageType.charAt(0).toUpperCase() + messageType.slice(1)} Message
                  </Text>
                </View>
              )}

              {/* Content */}
              {content && (
                <Text
                  style={[
                    styles.messageText,
                    theme.typography.bodyMedium,
                    { color: getTextColor() },
                  ]}
                >
                  {content}
                </Text>
              )}
            </>
          )}

          {/* Bottom row with timestamp and countdown */}
          <View style={styles.bottomRow}>
            <Text
              style={[
                styles.timestamp,
                theme.typography.labelSmall,
                { color: getTextColor() + '80' },
              ]}
            >
              {formatTime(timestamp)}
            </Text>

            {/* Integrated countdown for time-based expiry */}
            {expiryRule?.type === 'time' && !isExpired && isRevealed && (
              <IntegratedCountdown
                duration={expiryRule.duration_sec}
                size={16}
                strokeWidth={2}
                showText={false}
                onExpire={handleExpire}
                color={isMine ? theme.colors.text.inverse : theme.colors.ephemeral?.countdown}
              />
            )}

            {/* View once indicator */}
            {(expiryRule?.type === 'view' || expiryRule?.type === 'playback') && !hasBeenViewed && (
              <Ionicons
                name="eye-outline"
                size={14}
                color={getTextColor() + '80'}
                style={styles.viewOnceIcon}
              />
            )}
          </View>

          {/* Progress bar for time-based expiry */}
          {expiryRule?.type === 'time' && !isExpired && isRevealed && (
            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: theme.colors.ephemeral?.countdown,
                    width: '100%', // This should be animated based on time remaining
                  },
                ]}
              />
            </View>
          )}
        </TouchableOpacity>

        {/* Ephemeral type indicator */}
        {isEphemeral && !isExpired && (
          <View style={[styles.ephemeralBadge, { alignSelf: isMine ? 'flex-end' : 'flex-start' }]}>
            <Ionicons
              name={
                expiryRule?.type === 'view' ? 'eye-off' :
                expiryRule?.type === 'time' ? 'timer' :
                expiryRule?.type === 'playback' ? 'play-circle' :
                'sparkles'
              }
              size={10}
              color={theme.colors.text.tertiary}
            />
            <Text style={[styles.ephemeralText, { color: theme.colors.text.tertiary }]}>
              {expiryRule?.type === 'view' ? 'View once' :
               expiryRule?.type === 'time' ? 'Temporary' :
               expiryRule?.type === 'playback' ? 'Play once' :
               'Ephemeral'}
            </Text>
          </View>
        )}
      </View>
    </VanishAnimation>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '80%',
    position: 'relative',
  },
  glowLayer: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 20,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  messageTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messageText: {
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  viewOnceIcon: {
    marginLeft: 8,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 1,
  },
  ephemeralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ephemeralText: {
    fontSize: 10,
    fontWeight: '500',
  },
});