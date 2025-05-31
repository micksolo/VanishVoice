import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import RecipientSelector from '../components/RecipientSelector';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState<string>('Select Recipient');
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    // Check audio permissions on mount
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

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
        setRecordingDuration((prev) => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      pulseAnim.setValue(1);
      setRecordingDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = async () => {
    if (!selectedRecipient && recipientName !== 'Random') {
      Alert.alert('Select Recipient', 'Please select who you want to send the message to.');
      return;
    }

    try {
      if (!hasPermission) {
        const { status } = await Audio.requestPermissionsAsync();
        setHasPermission(status === 'granted');
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Please grant microphone permission to record audio.');
          return;
        }
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
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        // Navigate to preview screen
        navigation.navigate('MessagePreview', {
          audioUri: uri,
          duration: recordingDuration,
          recipientId: selectedRecipient,
          recipientName: recipientName,
        });
      }
    } catch (error) {
      console.error('Failed to stop recording', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome!</Text>
        <Text style={styles.friendCode}>
          Friend Code: {user?.friend_code || 'Loading...'}
        </Text>
      </View>

      <View style={styles.content}>
        <RecipientSelector
          selectedRecipient={selectedRecipient}
          onSelectRecipient={(id, name) => {
            setSelectedRecipient(id);
            setRecipientName(name);
          }}
        />
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
              size={60} 
              color={isRecording ? '#fff' : '#000'} 
            />
          </Animated.View>
        </TouchableOpacity>

        {isRecording && (
          <View style={styles.recordingInfo}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording...</Text>
            <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
          </View>
        )}

        <Text style={styles.instructions}>
          Hold to record a voice message{'\n'}(60 seconds max)
        </Text>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="shuffle-outline" size={24} color="#000" />
            <Text style={styles.actionText}>Random Connect</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="person-add-outline" size={24} color="#000" />
            <Text style={styles.actionText}>Add Friend</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  friendCode: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  recordButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButtonInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
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
    marginBottom: 20,
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
  instructions: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginBottom: 40,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    padding: 15,
  },
  actionText: {
    marginTop: 5,
    fontSize: 14,
    color: '#000',
  },
});