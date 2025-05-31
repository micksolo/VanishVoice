import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { uploadAudio } from '../utils/audioStorage';

interface RecordingModalProps {
  visible: boolean;
  recipientName: string;
  recipientId: string;
  userId: string;
  onClose: () => void;
  onSend: (audioPath: string, duration: number) => void;
}

export default function RecordingModal({
  visible,
  recipientName,
  recipientId,
  userId,
  onClose,
  onSend,
}: RecordingModalProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRecording) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Duration counter
      interval = setInterval(() => {
        setDuration((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      pulseAnim.setValue(1);
      setDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      // Check permissions first
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Microphone Permission Required',
          'Please enable microphone access in your device settings to send voice messages.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              // This will open app settings on iOS
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              }
            }}
          ]
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Recording Error', 'Unable to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      setIsUploading(true);
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        // Upload the audio file
        const audioPath = await uploadAudio(uri, userId);
        
        if (audioPath) {
          onSend(audioPath, duration);
        } else {
          Alert.alert('Error', 'Failed to upload voice message. Please try again.');
        }
      }
    } catch (error) {
      console.error('Failed to stop recording', error);
      Alert.alert('Error', 'Failed to send voice message.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>

          <Text style={styles.title}>Send to {recipientName}</Text>
          <Text style={styles.subtitle}>Hold to record</Text>

          <TouchableOpacity
            style={styles.recordButton}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.recordButtonInner,
                isRecording && styles.recordingActive,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Ionicons 
                name="mic" 
                size={40} 
                color={isRecording ? '#fff' : '#000'} 
              />
            </Animated.View>
          </TouchableOpacity>

          {isRecording && (
            <View style={styles.recordingInfo}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            </View>
          )}

          {isUploading && (
            <View style={styles.recordingInfo}>
              <ActivityIndicator size="small" color="#4ECDC4" />
              <Text style={styles.uploadingText}>Sending...</Text>
            </View>
          )}

          {!isUploading && <Text style={styles.hint}>Max 60 seconds</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButtonInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordingActive: {
    backgroundColor: '#ff3b30',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    color: '#ff3b30',
    marginRight: 8,
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
  },
  uploadingText: {
    fontSize: 16,
    color: '#4ECDC4',
    marginLeft: 8,
  },
  hint: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
  },
});