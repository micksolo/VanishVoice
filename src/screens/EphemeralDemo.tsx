import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import EphemeralMessageBubble from '../components/EphemeralMessageBubble';
import BlurredMessage from '../components/BlurredMessage';
import VanishAnimation, { VanishAnimationRef, VanishType } from '../components/VanishAnimation';
import IntegratedCountdown from '../components/IntegratedCountdown';
import { ExpiryRule } from '../types/database';

export default function EphemeralDemo() {
  const theme = useAppTheme();
  const [showBlur, setShowBlur] = useState(true);
  const [vanishType, setVanishType] = useState<VanishType>('dissolve');
  const vanishRef = React.useRef<VanishAnimationRef>(null);

  const demoMessages = [
    {
      id: '1',
      content: 'This message will disappear after viewing',
      isMine: false,
      timestamp: new Date(),
      expiryRule: { type: 'view' } as ExpiryRule,
      isEphemeral: true,
    },
    {
      id: '2',
      content: 'This message expires in 60 seconds',
      isMine: true,
      timestamp: new Date(),
      expiryRule: { type: 'time', duration_sec: 60 } as ExpiryRule,
      isEphemeral: true,
    },
    {
      id: '3',
      content: 'Voice message that plays once',
      isMine: false,
      timestamp: new Date(),
      expiryRule: { type: 'playback' } as ExpiryRule,
      isEphemeral: true,
      messageType: 'voice' as const,
    },
  ];

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Ephemeral Messaging Demo</Text>
        
        {/* Demo Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Demo Controls</Text>
          
          <View style={styles.control}>
            <Text style={styles.controlLabel}>Blur Before View</Text>
            <Switch
              value={showBlur}
              onValueChange={setShowBlur}
              trackColor={{ false: theme.colors.border.default, true: theme.colors.text.accent }}
            />
          </View>

          <View style={styles.control}>
            <Text style={styles.controlLabel}>Vanish Animation Type</Text>
            <View style={styles.buttonRow}>
              {(['fade', 'dissolve', 'particles', 'shrink'] as VanishType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    vanishType === type && styles.typeButtonActive,
                  ]}
                  onPress={() => setVanishType(type)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    vanishType === type && styles.typeButtonTextActive,
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Blur Effect Demo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blur Effect Demo</Text>
          <BlurredMessage
            content="This is a secret message. Tap to reveal it!"
            messageType="text"
          />
        </View>

        {/* Countdown Demo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Countdown Timer Demo</Text>
          <View style={styles.countdownRow}>
            <IntegratedCountdown
              duration={30}
              size={40}
              strokeWidth={3}
              showText={true}
            />
            <IntegratedCountdown
              duration={60}
              size={60}
              strokeWidth={4}
              showText={true}
            />
            <IntegratedCountdown
              duration={10}
              size={80}
              strokeWidth={5}
              showText={true}
            />
          </View>
        </View>

        {/* Vanish Animation Demo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vanish Animation Demo</Text>
          <VanishAnimation ref={vanishRef} type={vanishType}>
            <View style={styles.vanishDemo}>
              <Text style={styles.vanishText}>This will vanish!</Text>
              <TouchableOpacity
                style={styles.vanishButton}
                onPress={() => vanishRef.current?.vanish()}
              >
                <Text style={styles.vanishButtonText}>Trigger Vanish</Text>
              </TouchableOpacity>
            </View>
          </VanishAnimation>
        </View>

        {/* Message Bubbles Demo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ephemeral Messages</Text>
          <View style={styles.messagesContainer}>
            {demoMessages.map((message) => (
              <EphemeralMessageBubble
                key={message.id}
                {...message}
                blurBeforeView={showBlur}
                onPress={() => console.log('Message pressed:', message.id)}
                onExpire={() => console.log('Message expired:', message.id)}
              />
            ))}
          </View>
        </View>

        {/* Color Palette */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dark Theme Colors</Text>
          <View style={styles.colorGrid}>
            <View style={styles.colorItem}>
              <View style={[styles.colorSwatch, { backgroundColor: theme.colors.background.primary }]} />
              <Text style={styles.colorLabel}>Primary BG</Text>
            </View>
            <View style={styles.colorItem}>
              <View style={[styles.colorSwatch, { backgroundColor: theme.colors.ephemeral?.glow || '#8B5CF6' }]} />
              <Text style={styles.colorLabel}>Glow</Text>
            </View>
            <View style={styles.colorItem}>
              <View style={[styles.colorSwatch, { backgroundColor: theme.colors.ephemeral?.countdown || '#14B8A6' }]} />
              <Text style={styles.colorLabel}>Countdown</Text>
            </View>
            <View style={styles.colorItem}>
              <View style={[styles.colorSwatch, { backgroundColor: theme.colors.chat.sent }]} />
              <Text style={styles.colorLabel}>Sent</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  title: {
    ...theme.typography.headingLarge,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
  },
  sectionTitle: {
    ...theme.typography.headingMedium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  control: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  controlLabel: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  typeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.tertiary,
  },
  typeButtonActive: {
    backgroundColor: theme.colors.text.accent,
  },
  typeButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
  },
  typeButtonTextActive: {
    color: theme.colors.text.inverse,
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  vanishDemo: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  vanishText: {
    ...theme.typography.bodyLarge,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  vanishButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.text.accent,
    borderRadius: theme.borderRadius.md,
  },
  vanishButtonText: {
    ...theme.typography.bodyMedium,
    color: theme.colors.text.inverse,
  },
  messagesContainer: {
    gap: theme.spacing.md,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  colorItem: {
    alignItems: 'center',
  },
  colorSwatch: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  colorLabel: {
    ...theme.typography.labelSmall,
    color: theme.colors.text.secondary,
  },
});