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
import { useAppTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme';

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
  const theme = useAppTheme();
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

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
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
              color={theme.colors.text.inverse}
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
            <Ionicons name="time-outline" size={24} color={expiryType === 'time' ? theme.colors.text.accent : theme.colors.text.secondary} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, expiryType === 'time' && styles.selectedText]}>
                After Time
              </Text>
              <Text style={styles.optionDescription}>
                Disappears {expiryDuration} seconds after first listen
              </Text>
            </View>
            {expiryType === 'time' && (
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.text.accent} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.expiryOption, expiryType === 'playback' && styles.selectedOption]}
            onPress={() => setExpiryType('playback')}
          >
            <Ionicons name="headset-outline" size={24} color={expiryType === 'playback' ? theme.colors.text.accent : theme.colors.text.secondary} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, expiryType === 'playback' && styles.selectedText]}>
                After Playback
              </Text>
              <Text style={styles.optionDescription}>
                Disappears immediately after listening
              </Text>
            </View>
            {expiryType === 'playback' && (
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.text.accent} />
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
              <Ionicons name="send" size={20} color={theme.colors.text.inverse} />
              <Text style={styles.sendText}>Send</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  title: {
    ...theme.typography.headlineMedium,
    color: theme.colors.text.primary,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  recipientCard: {
    backgroundColor: theme.colors.background.tertiary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  recipientName: {
    ...theme.typography.headlineLarge,
    color: theme.colors.text.primary,
  },
  audioCard: {
    backgroundColor: theme.colors.primary.main,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    ...theme.shadows.medium,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.text.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  audioInfo: {
    flex: 1,
  },
  duration: {
    ...theme.typography.displaySmall,
    color: theme.colors.text.inverse,
  },
  audioLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.muted,
    marginTop: theme.spacing.xs,
  },
  expirySection: {
    marginTop: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.headlineMedium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  expiryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedOption: {
    backgroundColor: theme.colors.text.accentSecondary,
    borderColor: theme.colors.text.accent,
  },
  optionContent: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  optionTitle: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  selectedText: {
    color: theme.colors.text.accent,
  },
  optionDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.tertiary,
    alignItems: 'center',
  },
  cancelText: {
    ...theme.typography.button.medium,
    color: theme.colors.text.secondary,
  },
  sendButton: {
    flex: 2,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary.main,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    ...theme.shadows.small,
  },
  sendingButton: {
    opacity: 0.7,
  },
  sendText: {
    ...theme.typography.button.medium,
    color: theme.colors.text.inverse,
  },
});