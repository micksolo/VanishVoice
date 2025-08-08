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
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../contexts/ThemeContext';
import { ExpiryRule } from '../types/database';
import BlurredMessage from './BlurredMessage';
import ReadReceipt from './ReadReceipt';

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
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
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
  status = 'sent',
}: EphemeralMessageBubbleProps) {
  const theme = useAppTheme();
  const [isRevealed, setIsRevealed] = useState(!blurBeforeView || hasBeenViewed);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Animation values for pop-in effect
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [hasAnimated, setHasAnimated] = useState(false);
  
  // Reaction animation values
  const [showHeart, setShowHeart] = useState(false);
  const [hasReaction, setHasReaction] = useState(false); // Persistent reaction state
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const heartY = useRef(new Animated.Value(0)).current;
  const persistentHeartScale = useRef(new Animated.Value(0)).current; // For sticky heart
  const [lastTap, setLastTap] = useState(0);
  
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
  
  // Pop-in animation when message first appears
  useEffect(() => {
    if (!hasAnimated) {
      // Stagger the animation slightly for different message types
      const delay = messageType === 'text' ? 0 : messageType === 'voice' ? 100 : 200;
      
      setTimeout(() => {
        Animated.parallel([
          // Scale animation with spring physics
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 300,
            friction: 10,
            useNativeDriver: true,
          }),
          // Slide animation
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
        
        setHasAnimated(true);
      }, delay);
    }
  }, [hasAnimated, messageType]);

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


  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected - trigger heart reaction
      handleDoubleTab();
    } else {
      // Single tap - add spring animation and reveal
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 0.95,
          tension: 400,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 400,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
      
      setIsRevealed(true);
      onPress?.();
    }
    
    setLastTap(now);
  };
  
  const handleDoubleTab = () => {
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Toggle reaction state
    const newReactionState = !hasReaction;
    setHasReaction(newReactionState);
    
    if (newReactionState) {
      // Show floating heart animation for feedback
      setShowHeart(true);
      
      // Reset floating animation values
      heartScale.setValue(0);
      heartOpacity.setValue(1);
      heartY.setValue(0);
      
      // Run floating heart animation (quick feedback)
      Animated.parallel([
        Animated.spring(heartScale, {
          toValue: 1.2,
          tension: 200,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 1000, // Shorter duration
          useNativeDriver: true,
        }),
        Animated.timing(heartY, {
          toValue: -30, // Less distance
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowHeart(false);
      });
      
      // Animate persistent heart in
      Animated.spring(persistentHeartScale, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate persistent heart out
      Animated.spring(persistentHeartScale, {
        toValue: 0,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }
    
    // Also trigger the message reveal if not already revealed
    if (!isRevealed) {
      setIsRevealed(true);
      onPress?.();
    }
  };

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
          transform: [
            { scale: scaleAnim },
            { translateY: slideAnim }
          ],
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
          onPress={handlePress}
          activeOpacity={1} // Remove default opacity change since we handle animations
          disabled={isExpired}
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
              
              {/* Persistent heart reaction */}
              {hasReaction && (
                <Animated.View
                  style={[
                    styles.persistentHeart,
                    {
                      transform: [{ scale: persistentHeartScale }],
                    },
                  ]}
                >
                  <Ionicons
                    name="heart"
                    size={16}
                    color={theme.colors.text.accentSecondary || '#FF1B8D'}
                  />
                </Animated.View>
              )}
            </>
          )}

          {/* Bottom row with timestamp and countdown */}
          <View style={styles.bottomRow}>
            <View style={styles.timestampContainer}>
              <Text
                style={[
                  styles.timestamp,
                  theme.typography.labelSmall,
                  { color: getTextColor() + '80' },
                ]}
              >
                {formatTime(timestamp)}
              </Text>
              
              {/* Basic read receipt indicators */}
              {isMine && (
                <View style={styles.statusIndicator}>
                  <ReadReceipt
                    status={status}
                    textColor={getTextColor()}
                    variant={theme.name === 'neon' ? 'neon' : 'traditional'}
                    size={12}
                  />
                </View>
              )}
            </View>


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

        {/* Heart reaction animation */}
        {showHeart && (
          <Animated.View
            style={[
              styles.heartReaction,
              {
                opacity: heartOpacity,
                transform: [
                  { scale: heartScale },
                  { translateY: heartY }
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Ionicons
              name="heart"
              size={32}
              color={theme.colors.text.accentSecondary || '#FF1B8D'} // Use neon pink for heart
            />
          </Animated.View>
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
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
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
  heartReaction: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    zIndex: 1000,
    shadowColor: '#FF1B8D',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 10,
  },
  persistentHeart: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF1B8D',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
});