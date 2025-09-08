import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme';
import { formatVerificationEmojis } from '../utils/verificationHelpers';

interface SecurityVerificationModalProps {
  visible: boolean;
  verificationEmojis: string[];
  onVerified: () => void;
  onSkip: () => void;
  onCancel: () => void;
  onMitm?: () => void; // Called when MITM attack is detected
  mode?: 'full' | 'simplified'; // New prop to control verification mode
}

export default function SecurityVerificationModal({
  visible,
  verificationEmojis,
  onVerified,
  onSkip,
  onCancel,
  onMitm,
  mode = 'full',
}: SecurityVerificationModalProps) {
  const theme = useAppTheme();
  const [step, setStep] = useState<'explanation' | 'verification' | 'confirmation'>('explanation');
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      setStep('explanation');
      startPulseAnimation();
    }
  }, [visible]);

  const startPulseAnimation = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(pulse);
    };
    pulse();
  };

  const handleVerifyConnection = () => {
    Alert.alert(
      'Verify Connection',
      'Do you both see exactly the same emoji sequence?',
      [
        {
          text: 'No, different',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '🚨 SECURITY ALERT 🚨',
              'The emoji sequences don\'t match! This indicates a potential man-in-the-middle attack. Your connection may be compromised.\n\nFor your safety, we recommend ending this conversation and trying again.',
              [
                { text: 'Go Back', onPress: () => setStep('verification') },
                { 
                  text: 'End Conversation', 
                  style: 'destructive', 
                  onPress: () => {
                    if (onMitm) {
                      onMitm(); // Report MITM attack detected
                    } else {
                      onCancel(); // Fallback to cancel
                    }
                  }
                },
                { text: 'Continue At Risk', style: 'destructive', onPress: onSkip },
              ]
            );
          },
        },
        {
          text: 'Yes, identical',
          onPress: () => {
            setStep('confirmation');
            setTimeout(() => {
              onVerified();
            }, 1500);
          },
        },
      ]
    );
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Verification?',
      'Your connection will work but won\'t be verified as secure. You can verify later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: onSkip },
      ]
    );
  };

  const renderSimplified = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="shield-checkmark" size={64} color={theme.colors.text.accent} />
      </View>
      
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        Connection Secured
      </Text>
      
      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        Your chat is protected with end-to-end encryption.
      </Text>
      
      <View style={[styles.infoBox, { backgroundColor: theme.colors.background.tertiary }]}>
        <Text style={[styles.infoText, { color: theme.colors.text.primary }]}>
          Optional: You can verify this connection by comparing emojis with your chat partner.
        </Text>
      </View>

      <View style={[styles.emojiContainer, { backgroundColor: theme.colors.background.tertiary }]}>
        <Text style={styles.emojiSequence}>
          {formatVerificationEmojis(verificationEmojis)}
        </Text>
      </View>
      
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: theme.colors.text.accent }]}
        onPress={() => {
          setStep('confirmation');
          setTimeout(onVerified, 800);
        }}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text.inverse }]}>
          Start Chatting
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: theme.colors.border.default }]}
        onPress={handleVerifyConnection}
      >
        <Text style={[styles.secondaryButtonText, { color: theme.colors.text.primary }]}>
          Verify with Partner (Optional)
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.skipButton} onPress={() => {
        Alert.alert(
          'Learn More',
          'Your messages are end-to-end encrypted, meaning only you and your chat partner can read them. The emojis above are generated from your encryption keys - if they match what your partner sees, it confirms no one is intercepting your messages.',
          [{ text: 'Got it' }]
        );
      }}>
        <Text style={[styles.skipText, { color: theme.colors.text.accent }]}>
          Why verify emojis?
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderExplanation = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="shield-checkmark" size={64} color={theme.colors.text.accent} />
      </View>
      
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        Verify Secure Connection
      </Text>
      
      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        To ensure you're talking to the right person and prevent man-in-the-middle attacks, 
        let's verify your connection.
      </Text>
      
      <View style={[styles.infoBox, { backgroundColor: theme.colors.background.tertiary }]}>
        <Text style={[styles.infoText, { color: theme.colors.text.primary }]}>
          Both you and your chat partner will see the same emoji sequence if your connection is secure.
        </Text>
      </View>
      
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: theme.colors.text.accent }]}
        onPress={() => setStep('verification')}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text.inverse }]}>
          Start Verification
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={[styles.skipText, { color: theme.colors.text.secondary }]}>
          Skip for now
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderVerification = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Ionicons name="eye" size={48} color={theme.colors.text.accent} />
        </Animated.View>
      </View>
      
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        Compare Emojis
      </Text>
      
      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        Ask your chat partner: "Do you see these same emojis?"
      </Text>
      
      <View style={[styles.emojiContainer, { backgroundColor: theme.colors.background.tertiary }]}>
        <Text style={styles.emojiSequence}>
          {formatVerificationEmojis(verificationEmojis)}
        </Text>
      </View>
      
      <View style={[styles.warningBox, { backgroundColor: '#FFF3CD', borderColor: '#FFEB3B' }]}>
        <Ionicons name="warning" size={20} color="#F57C00" />
        <Text style={[styles.warningText, { color: '#E65100' }]}>
          If the emojis don't match exactly, your connection may not be secure!
        </Text>
      </View>
      
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: theme.colors.text.accent }]}
        onPress={handleVerifyConnection}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text.inverse }]}>
          We See The Same Emojis
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: theme.colors.border.default }]}
        onPress={() => setStep('explanation')}
      >
        <Text style={[styles.secondaryButtonText, { color: theme.colors.text.primary }]}>
          Back
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
      </View>
      
      <Text style={[styles.title, { color: '#4CAF50' }]}>
        Connection Verified!
      </Text>
      
      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        Your chat is now verified as secure. You can trust that you're talking to the right person.
      </Text>
      
      <View style={[styles.successBox, { backgroundColor: '#E8F5E8', borderColor: '#4CAF50' }]}>
        <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
        <Text style={[styles.successText, { color: '#2E7D32' }]}>
          End-to-end encryption verified
        </Text>
      </View>
    </View>
  );

  const styles = getStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          {mode === 'simplified' ? renderSimplified() : (
            <>
              {step === 'explanation' && renderExplanation()}
              {step === 'verification' && renderVerification()}
            </>
          )}
          {step === 'confirmation' && renderConfirmation()}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (theme: Theme) => {
  const { width } = Dimensions.get('window');
  
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      width: width * 0.9,
      maxWidth: 400,
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.borderRadius.xl,
      paddingBottom: theme.spacing.lg,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: theme.spacing.md,
      paddingBottom: 0,
    },
    closeButton: {
      padding: theme.spacing.xs,
    },
    stepContainer: {
      paddingHorizontal: theme.spacing.lg,
      alignItems: 'center',
    },
    iconContainer: {
      marginBottom: theme.spacing.lg,
    },
    title: {
      ...theme.typography.headlineMedium,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    subtitle: {
      ...theme.typography.bodyMedium,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: theme.spacing.lg,
    },
    infoBox: {
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.lg,
    },
    infoText: {
      ...theme.typography.bodySmall,
      textAlign: 'center',
      lineHeight: 18,
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    warningText: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
      flex: 1,
    },
    successBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    successText: {
      ...theme.typography.bodyMedium,
      fontWeight: '600',
    },
    emojiContainer: {
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing.lg,
      minHeight: 80,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    emojiSequence: {
      fontSize: 36,
      letterSpacing: 8,
      textAlign: 'center',
    },
    primaryButton: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing.md,
      width: '100%',
    },
    secondaryButton: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      width: '100%',
    },
    buttonText: {
      ...theme.typography.bodyMedium,
      fontWeight: '600',
      textAlign: 'center',
    },
    secondaryButtonText: {
      ...theme.typography.bodyMedium,
      fontWeight: '600',
      textAlign: 'center',
    },
    skipButton: {
      padding: theme.spacing.sm,
    },
    skipText: {
      ...theme.typography.bodySmall,
      textAlign: 'center',
    },
  });
};