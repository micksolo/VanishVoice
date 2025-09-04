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
import ReadReceipt from './ReadReceipt';
import { MessageStatusService, MessageStatus } from '../services/MessageStatusService';
import ViewOnceMessageManager from '../services/ViewOnceMessageManager';
// SHELVED: Screenshot prevention feature
// import SecurityShield from './SecurityShield';
// import SecurityTrustScore from './SecurityTrustScore';
import { ExpiryRule } from '../types/database';
// import { useSecurity } from '../contexts/SecurityContext';

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
  status?: MessageStatus;
  readReceiptVariant?: 'traditional' | 'neon' | 'eye' | 'lightning';
  screenshotAttempts?: number;
  showSecurityTrustScore?: boolean;
  senderCleared?: boolean;
  recipientCleared?: boolean;
  onViewOnceCleared?: (messageId: string) => void;
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
  status = 'sent',
  readReceiptVariant = 'traditional',
  screenshotAttempts = 0,
  showSecurityTrustScore = false,
  senderCleared = false,
  recipientCleared = false,
  onViewOnceCleared,
}: MessageBubbleProps) {
  const theme = useAppTheme();
  // SHELVED: Screenshot prevention feature
  // const { isSecureModeEnabled, isPremiumUser } = useSecurity();
  const isSecureModeEnabled = false; // Disabled
  const isPremiumUser = false; // Disabled
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const disappearAnim = useRef(new Animated.Value(1)).current;
  const viewedPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isExpired || status === 'disappeared') {
      // Fade out animation for expired/disappeared messages
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
        Animated.timing(disappearAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (status === 'viewed' && ViewOnceMessageManager.isViewOnceMessage(expiryRule || { type: 'none' })) {
      // Pulse animation when view-once message is viewed
      Animated.sequence([
        Animated.timing(viewedPulseAnim, {
          toValue: 1.05,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(viewedPulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isEphemeral && !hasBeenViewed && status !== 'viewed') {
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
  }, [isExpired, isEphemeral, hasBeenViewed, status]);

  const getBubbleColor = () => {
    if (isExpired || status === 'disappeared') {
      return theme.colors.text.disabled + '40';
    }
    
    if (status === 'viewed' && ViewOnceMessageManager.isViewOnceMessage(expiryRule || { type: 'none' })) {
      // Slightly dimmed color for viewed view-once messages
      return isMine 
        ? theme.colors.chat.sent + 'CC'
        : theme.colors.chat.received + 'CC';
    }
    
    if (isMine) {
      return theme.colors.chat.sent;
    } else {
      return theme.colors.chat.received;
    }
  };

  const getTextColor = () => {
    if (isExpired || status === 'disappeared') {
      return theme.colors.text.disabled;
    }
    
    if (status === 'viewed' && ViewOnceMessageManager.isViewOnceMessage(expiryRule || { type: 'none' })) {
      // Slightly dimmed text for viewed view-once messages
      return isMine 
        ? theme.colors.chat.sentText + 'AA'
        : theme.colors.chat.receivedText + 'AA';
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
          transform: [
            { scale: scaleAnim },
            { scale: viewedPulseAnim },
          ],
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

        {/* Timestamp and status row */}
        <View style={styles.timestampRow}>
          <Text
            style={[
              styles.timestamp,
              theme.typography.labelSmall,
              { color: getTextColor() + '80' },
            ]}
          >
            {formatTime(timestamp)}
          </Text>
          
          {/* Read receipt indicators (only for sent messages) */}
          {isMine && (
            <View style={styles.statusIndicator}>
              <ReadReceipt
                status={status === 'viewed' ? 'read' : status === 'disappeared' ? 'read' : status || 'sent'}
                textColor={getTextColor()}
                variant={readReceiptVariant}
                size={12}
              />
              
              {/* View-once status indicator */}
              {ViewOnceMessageManager.isViewOnceMessage(expiryRule || { type: 'none' }) && (
                <View style={styles.viewOnceIndicator}>
                  {status === 'viewed' && (
                    <Animated.View style={{
                      opacity: disappearAnim,
                      transform: [{ scale: viewedPulseAnim }]
                    }}>
                      <Ionicons
                        name="eye"
                        size={10}
                        color={theme.colors.text.accent}
                        style={styles.viewOnceIcon}
                      />
                    </Animated.View>
                  )}
                  {status === 'disappeared' && (
                    <Ionicons
                      name="eye-off"
                      size={10}
                      color={theme.colors.text.disabled}
                      style={styles.viewOnceIcon}
                    />
                  )}
                </View>
              )}
            </View>
          )}
        </View>

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
      
      {/* SHELVED: Screenshot prevention feature */}
      {/* Security indicator for sensitive messages */}
      {/* {isSecureModeEnabled && (messageType === 'voice' || messageType === 'video' || isEphemeral) && (
        <View style={[styles.securityIndicator, { alignSelf: isMine ? 'flex-end' : 'flex-start' }]}>
          <SecurityShield
            size="small"
            isActive={true}
            showLabel={false}
            messageType={messageType}
          />
        </View>
      )} */}
      
      {/* SHELVED: Screenshot prevention feature */}
      {/* Security Trust Score (shows screenshot attempts) */}
      {/* {showSecurityTrustScore && screenshotAttempts > 0 && (
        <View style={[styles.trustScoreContainer, { alignSelf: isMine ? 'flex-end' : 'flex-start' }]}>
          <SecurityTrustScore
            screenshotAttempts={screenshotAttempts}
            messageType={messageType}
            variant="inline"
            size="small"
            showLabel={true}
          />
        </View>
      )} */}
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
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timestamp: {
    flex: 1,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
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
  securityIndicator: {
    marginTop: 4,
    marginHorizontal: 8,
  },
  trustScoreContainer: {
    marginTop: 4,
    marginHorizontal: 8,
  },
  viewOnceIndicator: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewOnceIcon: {
    marginLeft: 2,
  },
});