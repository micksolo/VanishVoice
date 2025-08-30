import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme';
import { formatVerificationEmojis } from '../utils/verificationHelpers';

interface SecurityStatusNotificationProps {
  visible: boolean;
  verificationEmojis: string[];
  onVerify: () => void;
  onDismiss: () => void;
  onViewDetails: () => void;
}

export default function SecurityStatusNotification({
  visible,
  verificationEmojis,
  onVerify,
  onDismiss,
  onViewDetails,
}: SecurityStatusNotificationProps) {
  const theme = useAppTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!visible) return null;

  const handleVerifyConnection = () => {
    Alert.alert(
      'Quick Verification',
      `Ask your chat partner: "Do you see these emojis?\n\n${formatVerificationEmojis(verificationEmojis)}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Same Emojis',
          onPress: () => {
            onVerify();
            Alert.alert('✅ Verified', 'Your connection is secure!');
          },
        },
        {
          text: 'No, Different',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '🚨 Security Alert',
              'Different emojis may indicate a security issue. Consider ending this chat and starting a new one.',
              [
                { text: 'Continue Anyway', style: 'destructive', onPress: onDismiss },
                { text: 'End Chat', onPress: () => {} }, // Handle navigation back
              ]
            );
          },
        },
      ]
    );
  };

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <Ionicons name="shield-checkmark" size={20} color={theme.colors.text.accent} />
          <Text style={[styles.statusText, { color: theme.colors.text.primary }]}>
            Secure Connection Active
          </Text>
          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={theme.colors.text.secondary} 
            />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Ionicons name="close" size={16} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <View style={styles.expandedContent}>
          <Text style={[styles.description, { color: theme.colors.text.secondary }]}>
            Your messages are end-to-end encrypted. For extra verification, you can confirm these emojis match.
          </Text>
          
          <View style={styles.emojiRow}>
            <Text style={styles.emojiText}>
              {formatVerificationEmojis(verificationEmojis)}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.verifyButton, { backgroundColor: theme.colors.text.accent }]}
              onPress={handleVerifyConnection}
            >
              <Text style={[styles.buttonText, { color: theme.colors.text.inverse }]}>
                Quick Verify
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.detailsButton}
              onPress={onViewDetails}
            >
              <Text style={[styles.detailsText, { color: theme.colors.text.accent }]}>
                Learn More
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const getStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      margin: theme.spacing.sm,
      marginBottom: 0,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.sm,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      flex: 1,
    },
    statusText: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
    },
    dismissButton: {
      padding: theme.spacing.xs,
    },
    expandedContent: {
      paddingHorizontal: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.default,
    },
    description: {
      ...theme.typography.bodySmall,
      marginTop: theme.spacing.xs,
      lineHeight: 18,
    },
    emojiRow: {
      backgroundColor: theme.colors.background.tertiary,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      alignItems: 'center',
    },
    emojiText: {
      fontSize: 24,
      letterSpacing: 4,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    verifyButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
    },
    buttonText: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
    },
    detailsButton: {
      padding: theme.spacing.xs,
    },
    detailsText: {
      ...theme.typography.bodySmall,
      fontWeight: '500',
    },
  });
};