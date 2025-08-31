import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Text,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

interface VideoPlayerModalProps {
  visible: boolean;
  videoUri: string | null;
  onClose: () => void;
  onVideoComplete?: (messageId?: string) => void; // Callback for when video finishes playing
  messageId?: string; // Message ID for ephemeral message handling
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function VideoPlayerModal({
  visible,
  videoUri,
  onClose,
  onVideoComplete,
  messageId,
}: VideoPlayerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<Video>(null);

  // Cleanup video when modal closes or component unmounts
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.unloadAsync().catch(console.error);
      }
    };
  }, []);

  // Cleanup when visibility changes
  useEffect(() => {
    if (!visible && videoRef.current) {
      videoRef.current.unloadAsync().catch(console.error);
    }
  }, [visible]);

  // Reset state when video URI changes
  useEffect(() => {
    if (videoUri) {
      setIsLoading(true);
      setError(null);
      setIsPlaying(true);
      setPosition(0);
      setDuration(0);
    }
  }, [videoUri]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    console.log(`[VideoPlayer] Status update for messageId ${messageId}:`, {
      isLoaded: status.isLoaded,
      isPlaying: status.isLoaded ? status.isPlaying : false,
      positionMillis: status.isLoaded ? status.positionMillis : 0,
      durationMillis: status.isLoaded ? status.durationMillis : 0,
      didJustFinish: status.isLoaded ? status.didJustFinish : false,
      error: status.isLoaded ? null : status.error
    });

    if (status.isLoaded) {
      setIsLoading(false);
      setError(null);
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying || false);
      
      if (status.didJustFinish) {
        // Video finished playing - handle ephemeral message expiry
        console.log(`[VideoPlayer] 🎬 VIDEO COMPLETION DETECTED - handling completion`);
        console.log(`[VideoPlayer] Video completion details:`, {
          messageId,
          hasOnVideoComplete: !!onVideoComplete,
          videoUri,
          position: status.positionMillis,
          duration: status.durationMillis
        });
        setIsPlaying(false);
        
        // Notify parent component that video completed (for ephemeral messages)
        if (onVideoComplete && messageId) {
          console.log(`[VideoPlayer] 🚀 CALLING onVideoComplete for message: ${messageId}`);
          onVideoComplete(messageId);
        } else {
          console.log(`[VideoPlayer] ❌ NOT calling onVideoComplete:`, {
            hasCallback: !!onVideoComplete,
            hasMessageId: !!messageId,
            messageId
          });
        }
        
        // Small delay to prevent race conditions during cleanup
        setTimeout(() => {
          console.log(`[VideoPlayer] 🔒 CLOSING MODAL after completion`);
          handleClose();
        }, 100);
      }
    } else {
      // Handle loading errors - but filter out harmless end-of-playback errors
      const errorMessage = status.error;
      const isHarmlessError = 
        errorMessage === 'Player error: null' || 
        errorMessage === null ||
        errorMessage === undefined ||
        (typeof errorMessage === 'string' && errorMessage.includes('Player error: null'));
      
      setIsLoading(false);
      
      // Only show user-facing errors for genuine problems, not end-of-playback states
      if (!isHarmlessError) {
        setError(errorMessage || 'Failed to load video');
        console.error(`[VideoPlayer] Actual playback error:`, errorMessage);
        console.error(`[VideoPlayer] Video URI:`, videoUri);
      } else {
        // This is normal player cleanup after successful playback - no error logging needed
        if (errorMessage !== undefined) {
          console.log(`[VideoPlayer] Normal cleanup state:`, errorMessage);
        }
        setError(null); // Clear any previous errors
      }
    }
  };

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleClose = async () => {
    // Cleanup video before closing
    if (videoRef.current) {
      try {
        await videoRef.current.pauseAsync();
        await videoRef.current.unloadAsync();
      } catch (error) {
        console.error('[VideoPlayer] Error cleaning up video:', error);
      }
    }
    onClose();
  };

  if (!videoUri) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={handleClose}
        >
          <View style={styles.playerContainer}>
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={styles.video}
              shouldPlay={true}
              isLooping={false}
              resizeMode={ResizeMode.CONTAIN}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              useNativeControls={false}
              // Android-specific props for better compatibility
              {...(Platform.OS === 'android' && {
                androidImplementation: 'MediaPlayer',
              })}
            />

            {/* Loading indicator */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="white" />
                <Text style={styles.loadingText}>Loading video...</Text>
              </View>
            )}
            
            {/* Error display */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color="white" />
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.errorSubtext}>Unable to play video</Text>
              </View>
            )}

            {/* Controls overlay */}
            <TouchableOpacity 
              style={styles.controlsOverlay}
              activeOpacity={1}
              onPress={togglePlayPause}
            >
              {!isLoading && !isPlaying && (
                <View style={styles.playButton}>
                  <Ionicons name="play" size={60} color="white" />
                </View>
              )}
            </TouchableOpacity>

            {/* Top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
            </View>

            {/* Bottom bar */}
            <View style={styles.bottomBar}>
              <Text style={styles.timeText}>
                {formatTime(position)} / {formatTime(duration)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerContainer: {
    width: screenWidth,
    height: screenHeight * 0.8,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  timeText: {
    color: 'white',
    fontSize: 14,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    marginTop: 10,
    fontWeight: '600',
  },
  errorSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 5,
  },
});