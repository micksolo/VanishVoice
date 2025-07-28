import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Removed expo-blur import - using opacity instead
import { useTheme } from '../contexts/ThemeContext';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import { Message } from '../types/database';
import { supabase } from '../services/supabase';
import { downloadAndDecryptE2EAudio } from '../utils/secureE2EAudioStorage';
import { SecureE2EVideoStorageFastAndroid } from '../utils/secureE2EVideoStorageFastAndroid';
import * as FileSystem from 'expo-file-system';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../contexts/AnonymousAuthContext';

interface ViewingOverlayProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
  onMessageExpired?: (messageId: string) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ViewingOverlay({ 
  visible, 
  message, 
  onClose, 
  onMessageExpired 
}: ViewingOverlayProps) {
  const theme = useTheme();
  const { user } = useAuth();
  const [isMarkedAsViewed, setIsMarkedAsViewed] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isVanishing, setIsVanishing] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mark message as viewed and load media when overlay opens
  useEffect(() => {
    const initializeViewing = async () => {
      if (visible && message && !isMarkedAsViewed) {
        try {
          // Only mark as viewed if we're the recipient
          const isRecipient = message.recipient_id === user?.id;
          
          if (isRecipient) {
            // Mark as viewed
            const { data, error } = await supabase
              .rpc('mark_message_viewed', { message_id: message.id });
            
            if (!error && data) {
              setIsMarkedAsViewed(true);
              
              // Check if this is a view-once message
              if (message.expiry_rule.type === 'view') {
                // For text messages, start vanish animation after a brief delay
                if (message.type === 'text') {
                  setTimeout(() => {
                    handleVanish();
                  }, 2000);
                }
                // For voice/video, vanish happens after playback
              }
            }
          } else {
            // For senders viewing their own messages, just mark as viewed locally
            setIsMarkedAsViewed(true);
            
            // For view-once messages sent by us, show vanish animation
            if (message.expiry_rule.type === 'view') {
              if (message.type === 'text') {
                setTimeout(() => {
                  handleVanish();
                }, 2000);
              }
            }
          }

          // Load media for voice/video messages
          if (message.type === 'voice' || message.type === 'video') {
            setIsLoading(true);
            try {
              if (message.type === 'voice') {
                // Download and decrypt voice message
                const decryptedUri = await downloadAndDecryptE2EAudio(
                  message.media_path || '',
                  message.content || '', // encrypted key
                  message.nonce || '',
                  message.sender_id,
                  user?.id || ''
                );
                if (decryptedUri) {
                  setAudioUri(decryptedUri);
                }
              } else if (message.type === 'video') {
                // Download and decrypt video message
                const decryptedUri = await SecureE2EVideoStorageFastAndroid.downloadAndDecryptVideo(
                  message.media_path || '', // videoId
                  message.content || '', // encrypted key
                  message.nonce || '', // key nonce
                  message.sender_id,
                  user?.id || '',
                  undefined,
                  message.video_nonce // video-specific nonce
                );
                if (decryptedUri) {
                  setVideoUri(decryptedUri);
                }
              }
            } catch (error) {
              console.error('Error loading media:', error);
            } finally {
              setIsLoading(false);
            }
          }
        } catch (error) {
          console.error('Error marking message as viewed:', error);
        }
      }
    };

    initializeViewing();
  }, [visible, message, isMarkedAsViewed, user]);

  // Fade in/out animation
  useEffect(() => {
    if (visible && !isVanishing) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim, isVanishing]);

  const handleVanish = useCallback(() => {
    setIsVanishing(true);
    
    // Vanish animation
    Animated.sequence([
      // Brief pulse
      Animated.timing(fadeAnim, {
        toValue: 1.1,
        duration: 200,
        useNativeDriver: true,
      }),
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (message && onMessageExpired) {
        onMessageExpired(message.id);
      }
      onClose();
      // Reset state after closing
      setTimeout(() => {
        setIsMarkedAsViewed(false);
        setIsVanishing(false);
        fadeAnim.setValue(0);
      }, 100);
    });
  }, [fadeAnim, message, onClose, onMessageExpired]);

  const handleClose = useCallback(() => {
    if (!isVanishing) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        onClose();
        // Reset state after closing
        setTimeout(() => {
          setIsMarkedAsViewed(false);
          setAudioUri(null);
          setVideoUri(null);
          fadeAnim.setValue(0);
        }, 100);
      });
    }
  }, [fadeAnim, onClose, isVanishing]);

  if (!message) return null;

  const isEphemeral = message.expiry_rule.type !== 'none';
  const expiryText = (() => {
    switch (message.expiry_rule.type) {
      case 'view':
        return 'This message will vanish after viewing';
      case 'playback':
        return 'This message will vanish after playback';
      case 'read':
        return 'This message will vanish after reading';
      case 'time':
        return `Expires in ${(message.expiry_rule as any).duration_sec || 0} seconds`;
      case 'none':
        return '';
      default:
        return '';
    }
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
            backgroundColor: 'rgba(0,0,0,0.95)',
          }
        ]}
      >
        <TouchableOpacity 
          style={[styles.backdrop, StyleSheet.absoluteFillObject]} 
          activeOpacity={1} 
          onPress={handleClose}
        >
            <Animated.View 
              style={[
                styles.content,
                {
                  transform: [
                    {
                      scale: fadeAnim.interpolate({
                        inputRange: [0, 1, 1.1],
                        outputRange: [0.9, 1, 1.05],
                      }),
                    },
                  ],
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              {/* Close button */}
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.colors.button.secondary.background + '20' }]}
                onPress={handleClose}
                disabled={isVanishing}
              >
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>

              {/* Ephemeral indicator */}
              {isEphemeral && (
                <View style={[styles.ephemeralBadge, { backgroundColor: theme.colors.text.danger + '20' }]}>
                  <Ionicons name="time-outline" size={16} color={theme.colors.text.danger} />
                  <Text style={[styles.ephemeralText, { color: theme.colors.text.danger }]}>
                    {expiryText}
                  </Text>
                </View>
              )}

              {/* Message content */}
              <View style={styles.messageContainer}>
                {message.type === 'text' ? (
                  <View style={styles.textContainer}>
                    <Text style={[styles.messageText, { color: theme.colors.text.primary }]}>
                      {message.content}
                    </Text>
                  </View>
                ) : message.type === 'voice' ? (
                  <View style={styles.voiceContainer}>
                    {isLoading ? (
                      <ActivityIndicator size="large" color={theme.colors.text.accent} />
                    ) : audioUri ? (
                      <VoiceMessagePlayer
                        audioUri={audioUri}
                        duration={message.duration || 0}
                        isEphemeral={true}
                        size="large"
                        onPlayComplete={() => {
                          if (message.expiry_rule.type === 'playback' || message.expiry_rule.type === 'view') {
                            setTimeout(() => {
                              handleVanish();
                            }, 1000);
                          }
                        }}
                      />
                    ) : (
                      <Text style={[styles.errorText, { color: theme.colors.text.danger }]}>
                        Failed to load voice message
                      </Text>
                    )}
                  </View>
                ) : message.type === 'video' ? (
                  <View style={styles.videoContainer}>
                    {isLoading ? (
                      <ActivityIndicator size="large" color={theme.colors.text.accent} />
                    ) : videoUri ? (
                      <Video
                        source={{ uri: videoUri }}
                        style={styles.video}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay
                        onPlaybackStatusUpdate={(status) => {
                          if ('didJustFinish' in status && status.didJustFinish) {
                            if (message.expiry_rule.type === 'playback' || message.expiry_rule.type === 'view') {
                              setTimeout(() => {
                                handleVanish();
                              }, 1000);
                            }
                          }
                        }}
                      />
                    ) : (
                      <Text style={[styles.errorText, { color: theme.colors.text.danger }]}>
                        Failed to load video message
                      </Text>
                    )}
                  </View>
                ) : null}
              </View>

              {/* Vanishing indicator */}
              {isVanishing && (
                <View style={styles.vanishingOverlay}>
                  <ActivityIndicator size="large" color={theme.colors.text.accent} />
                  <Text style={[styles.vanishingText, { color: theme.colors.text.primary }]}>
                    Message vanishing...
                  </Text>
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Dark overlay effect instead of blur
  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  ephemeralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  ephemeralText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  messageContainer: {
    width: '100%',
    alignItems: 'center',
  },
  textContainer: {
    padding: 20,
    minHeight: 100,
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
  },
  voiceContainer: {
    width: '100%',
    paddingVertical: 20,
  },
  videoContainer: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  vanishingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vanishingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
});