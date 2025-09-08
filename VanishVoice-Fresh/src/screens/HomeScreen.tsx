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
import { useAppTheme } from '../contexts/ThemeContext';
import RecipientSelector from '../components/RecipientSelector';
import { Button } from '../components/ui';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const theme = useAppTheme();
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <View style={styles.header}>
        <Text style={[styles.welcomeText, theme.typography.displayMedium, { color: theme.colors.text.primary }]}>WYD</Text>
        <Text style={[styles.subtitle, theme.typography.bodyLarge, { color: theme.colors.text.secondary }]}>What You Doing?</Text>
        <Text style={[styles.friendCode, theme.typography.bodySmall, { color: theme.colors.text.secondary }]}>
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
              isRecording && [styles.recordingActive, { backgroundColor: theme.colors.recording.active }],
              { 
                transform: [{ scale: pulseAnim }],
                backgroundColor: isRecording ? theme.colors.recording.active : theme.colors.background.elevated,
                ...theme.shadows.medium,
              },
            ]}
          >
            <Ionicons 
              name="mic" 
              size={60} 
              color={isRecording ? theme.colors.text.inverse : theme.colors.text.primary} 
            />
          </Animated.View>
        </TouchableOpacity>

        {isRecording && (
          <View style={styles.recordingInfo}>
            <View style={[styles.recordingDot, { backgroundColor: theme.colors.recording.active }]} />
            <Text style={[styles.recordingText, theme.typography.bodyMedium, { color: theme.colors.recording.active }]}>Recording...</Text>
            <Text style={[styles.durationText, theme.typography.headlineSmall, { color: theme.colors.text.primary }]}>{formatDuration(recordingDuration)}</Text>
          </View>
        )}

        <Text style={[styles.instructions, theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>
          Hold to record a voice message{'\n'}(60 seconds max)
        </Text>

        <View style={styles.quickActions}>
          <Button
            variant="secondary"
            onPress={() => navigation.navigate('AnonymousLobby')}
            icon={<Ionicons name="shuffle-outline" size={24} color={theme.colors.text.primary} />}
            style={styles.actionButton}
          >
            Random Connect
          </Button>
          
          <Button
            variant="secondary"
            onPress={() => navigation.navigate('Friends')}
            icon={<Ionicons name="person-add-outline" size={24} color={theme.colors.text.primary} />}
            style={styles.actionButton}
          >
            Add Friend
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  welcomeText: {
    // Using theme typography
  },
  subtitle: {
    marginTop: 4,
  },
  friendCode: {
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButtonInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingActive: {
    // Color handled in component
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
    marginRight: 8,
  },
  recordingText: {
    marginRight: 8,
  },
  durationText: {
    // Using theme typography
  },
  instructions: {
    textAlign: 'center',
    marginBottom: 40,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 16,
    paddingHorizontal: 20,
  },
  actionButton: {
    flex: 1,
  },
});