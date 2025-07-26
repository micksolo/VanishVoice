import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Alert,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { VideoCompressorUtil } from '../utils/videoCompressor';

interface VideoRecordingModalProps {
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (uri: string) => void;
  maxDuration?: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function VideoRecordingModal({
  visible,
  onClose,
  onVideoRecorded,
  maxDuration = 30,
}: VideoRecordingModalProps) {
  const [facing, setFacing] = useState<CameraType>('front');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const cameraRef = useRef<CameraView>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  useEffect(() => {
    if (!visible) {
      setVideoUri(null);
      setRecordingDuration(0);
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }
  }, [visible]);

  const hasPermissions = cameraPermission?.granted && microphonePermission?.granted;

  const requestPermissions = async () => {
    const cameraResult = await requestCameraPermission();
    const micResult = await requestMicrophonePermission();
    return cameraResult.granted && micResult.granted;
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;

    try {
      setIsRecording(true);
      setRecordingDuration(0);

      recordingInterval.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      // Different approach for Android vs iOS
      let videoOptions: any = {
        maxDuration: maxDuration,
      };

      if (Platform.OS === 'ios') {
        // iOS settings - bitrate often ignored but we try anyway
        videoOptions = {
          ...videoOptions,
          videoQuality: '720p', // Decent quality
          codec: 'avc1',
          videoBitrate: 2000000, // 2 Mbps (like WhatsApp)
        };
      } else {
        // Android settings
        videoOptions = {
          ...videoOptions,
          videoQuality: '720p',
          videoBitrate: 2000000, // 2 Mbps
          mute: false,
        };
      }

      console.log('[VideoRecording] Recording with options:', videoOptions);
      const video = await cameraRef.current.recordAsync(videoOptions);
      
      if (video) {
        // Clear the interval first to get final duration
        if (recordingInterval.current) {
          clearInterval(recordingInterval.current);
        }
        
        setVideoUri(video.uri);
        
        // Log video size for performance tracking
        const videoInfo = await FileSystem.getInfoAsync(video.uri);
        const sizeMB = ((videoInfo.size || 0) / 1024 / 1024).toFixed(2);
        const expectedBitrate = 2000000; // 2 Mbps for both platforms
        
        // Calculate actual duration based on video metadata if possible
        // Otherwise use the recording duration state
        const actualDuration = recordingDuration || Math.round(parseFloat(sizeMB) * 8 * 1024 * 1024 / expectedBitrate);
        const expectedSizeMB = (expectedBitrate * actualDuration / 8 / 1024 / 1024).toFixed(1);
        const quality = Platform.OS === 'ios' ? '480p' : '288p';
        
        console.log(`[VideoRecording] Recorded video: ${sizeMB}MB at ${quality}/${(expectedBitrate/1000)}Kbps`);
        console.log(`[VideoRecording] Estimated duration: ${actualDuration}s`);
        console.log(`[VideoRecording] Expected size at ${(expectedBitrate/1000)}Kbps: ~${expectedSizeMB}MB`);
        
        if (parseFloat(sizeMB) > 10) {
          console.warn(`[VideoRecording] Video larger than expected! Bitrate settings may not be applied.`);
          console.warn(`[VideoRecording] Android often ignores video quality settings.`);
        }
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
      
      await cameraRef.current.stopRecording();
      setIsRecording(false);
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const retakeVideo = () => {
    setVideoUri(null);
    setRecordingDuration(0);
  };

  const sendVideo = async () => {
    if (!videoUri) return;

    try {
      setIsLoading(true);
      
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists) {
        throw new Error('Video file not found');
      }

      const fileSizeMB = (fileInfo.size || 0) / (1024 * 1024);
      console.log(`[VideoRecording] Original video size: ${fileSizeMB.toFixed(2)} MB`);

      // Accept the video as-is since we can't compress client-side
      // Server-side compression will be needed (like Snapchat, Telegram, etc.)
      console.log(`[VideoRecording] Sending ${fileSizeMB.toFixed(2)}MB video`);
      onVideoRecorded(videoUri);
      
      onClose();
    } catch (error) {
      console.error('Error sending video:', error);
      Alert.alert('Error', 'Failed to process video');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!cameraPermission || !microphonePermission) {
    return null;
  }

  if (!hasPermissions) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Camera and microphone permissions are required to record video.
            </Text>
            <TouchableOpacity 
              style={styles.permissionButton} 
              onPress={requestPermissions}
            >
              <Text style={styles.buttonText}>Grant Permissions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        {!videoUri ? (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              mode="video"
            />
            <View style={[styles.cameraOverlay, StyleSheet.absoluteFillObject]}>
                <View style={styles.topControls}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={onClose}
                    disabled={isRecording}
                  >
                    <Ionicons name="close" size={30} color="white" />
                  </TouchableOpacity>

                  <View style={styles.durationContainer}>
                    <Text style={styles.durationText}>
                      {formatDuration(recordingDuration)} / {formatDuration(maxDuration)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={toggleCameraFacing}
                    disabled={isRecording}
                  >
                    <Ionicons name="camera-reverse" size={30} color="white" />
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomControls}>
                  <TouchableOpacity
                    style={[
                      styles.recordButton,
                      isRecording && styles.recordingButton,
                    ]}
                    onPress={isRecording ? stopRecording : startRecording}
                  >
                    <View style={isRecording ? styles.recordingInner : styles.recordInner} />
                  </TouchableOpacity>
                </View>
              </View>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            <Video
              source={{ uri: videoUri }}
              style={styles.videoPreview}
              shouldPlay
              isLooping
              resizeMode={ResizeMode.COVER}
            />

            <View style={styles.previewOverlay}>
              <View style={styles.previewTopControls}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={retakeVideo}
                >
                  <Ionicons name="refresh" size={30} color="white" />
                </TouchableOpacity>
              </View>

              <View style={styles.previewBottomControls}>
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={retakeVideo}
                  disabled={isLoading}
                >
                  <Text style={styles.buttonText}>Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendButton, isLoading && styles.disabledButton]}
                  onPress={sendVideo}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Send</Text>
                      <Ionicons name="send" size={20} color="white" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 10,
  },
  closeButton: {
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  durationText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  durationSubtext: {
    color: 'white',
    fontSize: 10,
    marginTop: 2,
    opacity: 0.8,
  },
  bottomControls: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    borderColor: 'red',
  },
  recordInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'red',
  },
  recordingInner: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: 'red',
  },
  previewContainer: {
    flex: 1,
  },
  videoPreview: {
    flex: 1,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  previewTopControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  previewBottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 40,
    paddingHorizontal: 40,
  },
  retakeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});