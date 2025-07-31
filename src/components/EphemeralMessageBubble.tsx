import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { ExpiryRule } from '../types/database';
import IntegratedCountdown from './IntegratedCountdown';
import BlurredMessage from './BlurredMessage';

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
  const [isRevealed, setIsRevealed] = useState(!blurBeforeView || hasBeenViewed);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Calculate remaining time for time-based expiry
  const getRemainingSeconds = () => {
    if (expiryRule?.type !== 'time' || !expiryRule.duration_sec) {
      return 0;
    }
    
    const now = new Date();
    const createdAt = new Date(timestamp);
    const expiryTime = new Date(createdAt.getTime() + (expiryRule.duration_sec * 1000));
    const remainingMs = Math.max(0, expiryTime.getTime() - now.getTime());
    
    return Math.ceil(remainingMs / 1000);
  };
  
  // Animate fade when message has been viewed (for sender)
  useEffect(() => {
    if (isMine && hasBeenViewed && expiryRule?.type === 'view') {
      Animated.timing(fadeAnim, {
        toValue: 0.4,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [hasBeenViewed, isMine, expiryRule?.type]);


  const handleReveal = () => {
    setIsRevealed(true);
    onPress?.();
  };

  const handleExpire = () => {
    // Simple immediate expiry without animation
    onExpire?.();
  };

  const getBubbleColor = () => {
    if (isExpired) {
      return theme.colors.text.disabled + '40';
    }
    
    // For sender: fade out viewed messages
    if (isMine && hasBeenViewed && expiryRule?.type === 'view') {
      return theme.colors.chat.sent + '40'; // 25% opacity
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
    
    // For sender: fade out text for viewed messages
    if (isMine && hasBeenViewed && expiryRule?.type === 'view') {
      return theme.colors.chat.sentText + '60'; // 38% opacity
    }
    
    return isMine 
      ? theme.colors.chat.sentText 
      : theme.colors.chat.receivedText;
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
        },
        style,
      ]}
    >

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
              {/* Message type icon for non-text (no text label) */}
              {messageType !== 'text' && (
                <View style={styles.messageTypeRow}>
                  <Ionicons
                    name={messageType === 'voice' ? 'mic' : messageType === 'video' ? 'videocam' : 'image'}
                    size={20}
                    color={getTextColor()}
                  />
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
                duration={getRemainingSeconds()}
                size={16}
                strokeWidth={2}
                showText={false}
                onExpire={handleExpire}
                color={isMine ? theme.colors.text.inverse : theme.colors.ephemeral?.countdown}
              />
            )}

            {/* View once indicator or viewed status */}
            {(expiryRule?.type === 'view' || expiryRule?.type === 'playback') && (
              <View style={styles.viewOnceIndicator}>
                {hasBeenViewed ? (
                  // Show eye icon when viewed
                  <Ionicons
                    name="eye"
                    size={14}
                    color={getTextColor() + '80'}
                  />
                ) : (
                  // Show original view once indicator
                  <>
                    <Ionicons
                      name="radio-button-on"
                      size={14}
                      color={getTextColor() + '80'}
                    />
                    <Text style={[styles.viewOnceNumberText, { color: getTextColor() + '80' }]}>1</Text>
                  </>
                )}
              </View>
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
            {expiryRule?.type === 'view' ? (
              <View style={styles.ephemeralViewOnceIcon}>
                <Ionicons
                  name="radio-button-on"
                  size={10}
                  color={theme.colors.text.tertiary}
                />
                <Text style={[styles.ephemeralViewOnceNumber, { color: theme.colors.text.tertiary }]}>1</Text>
              </View>
            ) : (
              <Ionicons
                name={
                  expiryRule?.type === 'time' ? 'timer' :
                  expiryRule?.type === 'playback' ? 'play-circle' :
                  'timer'
                }
                size={10}
                color={theme.colors.text.tertiary}
              />
            )}
            <Text style={[styles.ephemeralText, { color: theme.colors.text.tertiary }]}>
              {expiryRule?.type === 'view' ? 'View once' :
               expiryRule?.type === 'time' ? 'Temporary' :
               expiryRule?.type === 'playback' ? 'Play once' :
               'Ephemeral'}
            </Text>
          </View>
        )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '80%',
    position: 'relative',
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
    justifyContent: 'center',
    marginBottom: 4,
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
  viewOnceIndicator: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
    marginLeft: 8,
  },
  viewOnceNumberText: {
    position: 'absolute',
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    top: 1,
    left: 0,
    right: 0,
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
  ephemeralViewOnceIcon: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 10,
    height: 10,
  },
  ephemeralViewOnceNumber: {
    position: 'absolute',
    fontSize: 6,
    fontWeight: 'bold',
    textAlign: 'center',
    top: 0.5,
    left: 0,
    right: 0,
  },
});