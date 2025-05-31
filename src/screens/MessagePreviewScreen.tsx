import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AnonymousAuthContext';

interface MessagePreviewScreenProps {
  route: {
    params: {
      audioUri: string;
      duration: number;
      recipientId: string | null;
      recipientName: string;
    };
  };
  navigation: any;
}

type ExpiryType = 'time' | 'location' | 'playback';

export default function MessagePreviewScreen({ route, navigation }: MessagePreviewScreenProps) {
  const { audioUri, duration, recipientId, recipientName } = route.params;
  const { user } = useAuth();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sending, setSending] = useState(false);
  const [expiryType, setExpiryType] = useState<ExpiryType>('time');
  const [expiryDuration, setExpiryDuration] = useState(60); // seconds

  const playPreview = async () => {
    try {
      if (sound && isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else if (sound) {
        await sound.playAsync();
        setIsPlaying(true);
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);
        
        newSound.setOnPlaybackStatusUpdate((status) => {
          if ('didJustFinish' in status && status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      }
    } catch (error) {
      console.error('Error playing preview:', error);
    }
  };

  const sendMessage = async () => {
    if (!user) return;

    setSending(true);
    try {
      // TODO: Upload audio to storage
      // TODO: Encrypt audio
      // For now, create a placeholder message
      
      const expiryRule = {
        type: expiryType,
        ...(expiryType === 'time' && { duration_sec: expiryDuration }),
        ...(expiryType === 'playback' && { play_count: 1 }),
      };

      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        recipient_id: recipientId || user.id, // Random would need special handling
        media_path: 'placeholder', // TODO: Real upload path
        expiry_rule: expiryRule,
      });

      if (error) throw error;

      Alert.alert(
        'Sent!',
        `Your voice message has been sent to ${recipientName}`,
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  React.useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Preview Message</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.recipientCard}>
          <Text style={styles.label}>Sending to:</Text>
          <Text style={styles.recipientName}>{recipientName}</Text>
        </View>

        <View style={styles.audioCard}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={playPreview}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={32}
              color="#fff"
            />
          </TouchableOpacity>
          <View style={styles.audioInfo}>
            <Text style={styles.duration}>
              {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </Text>
            <Text style={styles.audioLabel}>Voice Message</Text>
          </View>
        </View>

        <View style={styles.expirySection}>
          <Text style={styles.sectionTitle}>Message will vanish:</Text>
          
          <TouchableOpacity
            style={[styles.expiryOption, expiryType === 'time' && styles.selectedOption]}
            onPress={() => setExpiryType('time')}
          >
            <Ionicons name="time-outline" size={24} color={expiryType === 'time' ? '#4ECDC4' : '#666'} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, expiryType === 'time' && styles.selectedText]}>
                After Time
              </Text>
              <Text style={styles.optionDescription}>
                Disappears {expiryDuration} seconds after first listen
              </Text>
            </View>
            {expiryType === 'time' && (
              <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.expiryOption, expiryType === 'playback' && styles.selectedOption]}
            onPress={() => setExpiryType('playback')}
          >
            <Ionicons name="headset-outline" size={24} color={expiryType === 'playback' ? '#4ECDC4' : '#666'} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, expiryType === 'playback' && styles.selectedText]}>
                After Playback
              </Text>
              <Text style={styles.optionDescription}>
                Disappears immediately after listening
              </Text>
            </View>
            {expiryType === 'playback' && (
              <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendingButton]}
          onPress={sendMessage}
          disabled={sending}
        >
          {sending ? (
            <Text style={styles.sendText}>Sending...</Text>
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.sendText}>Send</Text>
            </>
          )}
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  recipientCard: {
    backgroundColor: '#f8f8f8',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  recipientName: {
    fontSize: 20,
    fontWeight: '600',
  },
  audioCard: {
    backgroundColor: '#000',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  audioInfo: {
    flex: 1,
  },
  duration: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  audioLabel: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 2,
  },
  expirySection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  expiryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginBottom: 10,
  },
  selectedOption: {
    backgroundColor: '#e8fffe',
    borderColor: '#4ECDC4',
    borderWidth: 1,
  },
  optionContent: {
    flex: 1,
    marginLeft: 15,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedText: {
    color: '#4ECDC4',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  sendButton: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendingButton: {
    opacity: 0.7,
  },
  sendText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});