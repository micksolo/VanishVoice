import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import EphemeralIndicator from './EphemeralIndicator';
import CountdownTimer from './CountdownTimer';
import { ExpiryRule } from '../types/database';

interface MessageBubbleProps {
  content?: string;
  isMine: boolean;
  timestamp: Date;
  expiryRule?: ExpiryRule;
  isEphemeral?: boolean;
  hasBeenViewed?: boolean;
  isExpired?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  showAvatar?: boolean;
  senderName?: string;
  messageType?: 'text' | 'voice' | 'video' | 'image';
}

export default function MessageBubble({
  content,
  isMine,
  timestamp,
  expiryRule,
  isEphemeral = false,
  hasBeenViewed = false,
  isExpired = false,
  onPress,
  style,
  showAvatar = false,
  senderName,
  messageType = 'text',
}: MessageBubbleProps) {
  const theme = useAppTheme();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isExpired) {
      // Fade out animation for expired messages
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isEphemeral && !hasBeenViewed) {
      // Subtle glow for unviewed ephemeral messages
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
  }, [isExpired, isEphemeral, hasBeenViewed]);

  const getBubbleColor = () => {
    if (isExpired) {
      return theme.colors.text.disabled + '40';
    }
    
    if (isMine) {
      return theme.colors.chat.sent;
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

  const getIcon = () => {
    switch (messageType) {
      case 'voice':
        return 'mic';
      case 'video':
        return 'videocam';
      case 'image':
        return 'image';
      default:
        return 'chatbubble';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          alignSelf: isMine ? 'flex-end' : 'flex-start',
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      {/* Avatar */}
      {showAvatar && !isMine && (
        <View style={[styles.avatar, { backgroundColor: theme.colors.text.accent }]}>
          <Text style={[styles.avatarText, { color: theme.colors.text.inverse }]}>
            {senderName ? senderName[0].toUpperCase() : '?'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.bubble,
          {
            backgroundColor: getBubbleColor(),
            borderBottomRightRadius: isMine ? 8 : theme.borderRadius.lg,
            borderBottomLeftRadius: isMine ? theme.borderRadius.lg : 8,
            marginLeft: isMine ? 50 : 0,
            marginRight: isMine ? 0 : 50,
            ...theme.shadows.small,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={isExpired}
      >
        {/* Ephemeral glow effect */}
        {isEphemeral && !hasBeenViewed && !isExpired && (
          <Animated.View
            style={[
              styles.glowEffect,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.3],
                }),
                borderColor: theme.colors.text.accent,
              },
            ]}
          />
        )}

        {/* Message type indicator */}
        {messageType !== 'text' && (
          <View style={styles.messageTypeContainer}>
            <Ionicons
              name={getIcon()}
              size={16}
              color={getTextColor()}
              style={styles.messageTypeIcon}
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

        {/* Timestamp */}
        <Text
          style={[
            styles.timestamp,
            theme.typography.labelSmall,
            { color: getTextColor() + '80' },
          ]}
        >
          {formatTime(timestamp)}
        </Text>

        {/* Privacy indicator for anonymous messages */}
        {!isMine && !senderName && (
          <View style={styles.privacyIndicator}>
            <Ionicons
              name="eye-off"
              size={12}
              color={getTextColor() + '60'}
            />
            <Text
              style={[
                styles.privacyText,
                theme.typography.labelSmall,
                { color: getTextColor() + '60' },
              ]}
            >
              Anonymous
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Ephemeral indicator */}
      {expiryRule && expiryRule.type !== 'none' && (
        <View style={[styles.indicatorContainer, { alignSelf: isMine ? 'flex-end' : 'flex-start' }]}>
          <EphemeralIndicator
            expiryRule={expiryRule}
            createdAt={timestamp}
            isMine={isMine}
            hasBeenViewed={hasBeenViewed}
          />
        </View>
      )}

      {/* Countdown timer for time-based expiry */}
      {expiryRule?.type === 'time' && !isExpired && (
        <View style={[styles.timerContainer, { alignSelf: isMine ? 'flex-end' : 'flex-start' }]}>
          <CountdownTimer
            duration={expiryRule.duration_sec}
            size="small"
            showIcon={false}
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '600',
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  glowEffect: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderRadius: 18,
  },
  messageTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageTypeIcon: {
    marginRight: 4,
  },
  messageTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messageText: {
    marginBottom: 4,
  },
  timestamp: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  privacyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  privacyText: {
  },
  indicatorContainer: {
    marginTop: 4,
  },
  timerContainer: {
    marginTop: 2,
  },
});