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
  onVideoClose?: (messageId: string) => void; // Callback for when video modal closes (for view-once clearing)
  messageId?: string; // Message ID for ephemeral message handling
  senderId?: string; // Sender ID for view-once clearing
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function VideoPlayerModal({
  visible,
  videoUri,
  onClose,
  onVideoComplete,
  onVideoClose,
  messageId,
  senderId,
}: VideoPlayerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [maxPositionReached, setMaxPositionReached] = useState(0);
  const [stallCount, setStallCount] = useState(0);
  const videoRef = useRef<Video>(null);
  const completionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef(0);
  const positionStallCountRef = useRef(0);

  // Cleanup video when modal closes or component unmounts
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.unloadAsync().catch(console.error);
      }
      // Clear completion timer if it exists
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    };
  }, []);

  // Cleanup when visibility changes
  useEffect(() => {
    if (!visible && videoRef.current) {
      videoRef.current.unloadAsync().catch(console.error);
      // Clear completion timer when modal closes
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
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
      setHasCompleted(false);
      setMaxPositionReached(0);
      lastPositionRef.current = 0;
      positionStallCountRef.current = 0;
      
      // Clear any existing completion timer
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    }
  }, [videoUri]);


  // Multi-layered video completion detection to handle expo-av limitations
  const triggerCompletion = (trigger: string) => {
    if (hasCompleted) return;
    
    console.log(`[VideoPlayer] 🎬 COMPLETION TRIGGERED by: ${trigger}`);
    setHasCompleted(true);
    setIsPlaying(false);
    
    // Clear completion timer if set
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    
    // Notify parent component
    if (onVideoComplete && messageId) {
      console.log(`[VideoPlayer] 🚀 CALLING onVideoComplete for message: ${messageId} (${trigger})`);
      onVideoComplete(messageId);
    }
    
    // Auto-close modal
    setTimeout(() => {
      console.log(`[VideoPlayer] 🚪 Closing modal after completion (${trigger})`);
      handleClose();
    }, 100);
  };

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
      
      const currentDuration = status.durationMillis || 0;
      const currentPosition = status.positionMillis || 0;
      const isCurrentlyPlaying = status.isPlaying || false;
      
      setDuration(currentDuration);
      setPosition(currentPosition);
      setIsPlaying(isCurrentlyPlaying);
      
      // Track maximum position reached
      if (currentPosition > maxPositionReached) {
        setMaxPositionReached(currentPosition);
      }
      
      // MULTI-LAYERED COMPLETION DETECTION
      if (currentDuration > 0 && !hasCompleted) {
        
        // 1. Traditional didJustFinish check (rarely works but worth checking)
        if (status.didJustFinish) {
          triggerCompletion('didJustFinish');
          return;
        }
        
        // 2. Near-end detection with generous threshold (1 second from end)
        const isVeryNearEnd = currentPosition >= (currentDuration - 1000);
        if (isVeryNearEnd && !isCurrentlyPlaying) {
          triggerCompletion('nearEndAndStopped');
          return;
        }
        
        // 3. Position-based completion (reached 95% of duration)
        const reachedNearEnd = currentPosition >= (currentDuration * 0.95);
        if (reachedNearEnd && !isCurrentlyPlaying) {
          triggerCompletion('95percentComplete');
          return;
        }
        
        // 4. Set up timer-based fallback when video reaches 80% of duration
        const reached80Percent = currentPosition >= (currentDuration * 0.8);
        if (reached80Percent && !completionTimerRef.current && isCurrentlyPlaying) {
          const remainingTime = currentDuration - currentPosition + 1000; // Add 1s buffer
          console.log(`[VideoPlayer] Setting completion timer for ${remainingTime}ms`);
          
          completionTimerRef.current = setTimeout(() => {
            triggerCompletion('timerFallback');
          }, remainingTime);
        }
        
        // 5. Position stall detection (position stops advancing near the end)
        if (currentPosition >= (currentDuration * 0.8)) {
          if (Math.abs(currentPosition - lastPositionRef.current) < 100) { // Position hasn't moved much
            positionStallCountRef.current += 1;
            
            // If position stalled for 3 consecutive checks near the end, consider it complete
            if (positionStallCountRef.current >= 3 && !isCurrentlyPlaying) {
              triggerCompletion('positionStall');
              return;
            }
          } else {
            positionStallCountRef.current = 0; // Reset stall counter if position is advancing
          }
        }
        
        lastPositionRef.current = currentPosition;
      }
      
    } else {
      // Handle unloaded state - this often happens at video end
      const errorMessage = status.error;
      const isHarmlessError = 
        errorMessage === 'Player error: null' || 
        errorMessage === null ||
        errorMessage === undefined ||
        (typeof errorMessage === 'string' && errorMessage.includes('Player error: null'));
      
      setIsLoading(false);
      
      // Check if we had significant playback before unloading (indicates natural end)
      if (isHarmlessError && maxPositionReached > 0 && !hasCompleted) {
        const estimatedDuration = duration || maxPositionReached * 1.1; // Estimate duration if unknown
        const playbackPercentage = maxPositionReached / estimatedDuration;
        
        console.log(`[VideoPlayer] Video unloaded after ${maxPositionReached}ms (${(playbackPercentage * 100).toFixed(1)}% complete)`);
        
        // If we reached at least 80% before unloading, consider it complete
        if (playbackPercentage >= 0.8) {
          triggerCompletion('unloadedAfterPlayback');
          return;
        }
      }
      
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
    // Clear completion timer
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    
    // Cleanup video before closing
    if (videoRef.current) {
      try {
        await videoRef.current.pauseAsync();
        await videoRef.current.unloadAsync();
      } catch (error) {
        console.error('[VideoPlayer] Error cleaning up video:', error);
      }
    }
    
    // Trigger view-once clearing if this is a view-once video being closed
    if (messageId && senderId && onVideoClose) {
      console.log(`[VideoPlayer] 🎬 Video modal closing - triggering view-once clearing for message ${messageId}`);
      onVideoClose(messageId);
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