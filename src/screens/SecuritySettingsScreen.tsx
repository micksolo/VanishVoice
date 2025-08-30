import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSecurity, SecurityLevel } from '../contexts/SecurityContext';
import { Theme } from '../theme';

export default function SecuritySettingsScreen({ navigation }: any) {
  const theme = useAppTheme();
  const { 
    securityLevel, 
    setSecurityLevel, 
    getSecurityDescription,
    isSecureModeEnabled,
    enableSecureMode,
    disableSecureMode,
    canPreventScreenshots,
    canDetectScreenshots,
  } = useSecurity();

  const [isUpdating, setIsUpdating] = useState(false);

  const handleSecurityLevelChange = async (level: SecurityLevel) => {
    if (level === securityLevel) return;
    
    setIsUpdating(true);
    try {
      await setSecurityLevel(level);
      
      // Show confirmation based on level
      let message = '';
      switch (level) {
        case 'silent':
          message = 'Security will now run silently in the background. You\'ll only be notified if something goes wrong.';
          break;
        case 'informed':
          message = 'You\'ll see security status for each chat with optional verification.';
          break;
        case 'paranoid':
          message = 'Full emoji verification will be required for every anonymous chat.';
          break;
      }
      
      Alert.alert('Security Level Updated', message);
    } catch (error) {
      console.error('Failed to update security level:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const renderSecurityOption = (
    level: SecurityLevel,
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    subtitle: string
  ) => {
    const isSelected = securityLevel === level;
    const styles = getStyles(theme);
    
    return (
      <TouchableOpacity
        style={[
          styles.optionCard,
          isSelected && styles.selectedCard,
          { borderColor: isSelected ? theme.colors.text.accent : theme.colors.border.default }
        ]}
        onPress={() => handleSecurityLevelChange(level)}
        disabled={isUpdating}
      >
        <View style={styles.optionHeader}>
          <View style={[
            styles.iconContainer,
            { backgroundColor: isSelected ? theme.colors.text.accent + '20' : theme.colors.background.tertiary }
          ]}>
            <Ionicons 
              name={icon} 
              size={24} 
              color={isSelected ? theme.colors.text.accent : theme.colors.text.secondary} 
            />
          </View>
          
          <View style={styles.optionInfo}>
            <Text style={[styles.optionTitle, { color: theme.colors.text.primary }]}>
              {title}
            </Text>
            <Text style={[styles.optionSubtitle, { color: theme.colors.text.secondary }]}>
              {subtitle}
            </Text>
          </View>
          
          {isSelected && (
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.text.accent} />
          )}
        </View>
        
        <Text style={[styles.optionDescription, { color: theme.colors.text.secondary }]}>
          {getSecurityDescription(level)}
        </Text>
      </TouchableOpacity>
    );
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          Security & Privacy
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Connection Verification
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.colors.text.secondary }]}>
            Choose how you want to verify the security of your anonymous chats. Higher levels provide more security but may require interaction with chat partners.
          </Text>
        </View>

        <View style={styles.options}>
          {renderSecurityOption(
            'silent',
            'Silent Protection',
            'shield-outline',
            'Recommended for most users'
          )}
          
          {renderSecurityOption(
            'informed',
            'Informed Protection',
            'shield-checkmark-outline',
            'See status with optional verification'
          )}
          
          {renderSecurityOption(
            'paranoid',
            'Maximum Protection',
            'shield',
            'Full verification required (advanced users)'
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Screenshot Protection
          </Text>
          
          <View style={[styles.featureCard, { backgroundColor: theme.colors.background.secondary }]}>
            <View style={styles.featureHeader}>
              <Ionicons 
                name={canPreventScreenshots ? "phone-portrait" : "phone-portrait-outline"} 
                size={24} 
                color={canPreventScreenshots ? "#4CAF50" : theme.colors.text.secondary} 
              />
              <View style={styles.featureInfo}>
                <Text style={[styles.featureTitle, { color: theme.colors.text.primary }]}>
                  Android Screenshot Blocking
                </Text>
                <Text style={[styles.featureStatus, { 
                  color: canPreventScreenshots ? "#4CAF50" : theme.colors.text.secondary 
                }]}>
                  {canPreventScreenshots ? "Active - Screenshots prevented" : "Not available on iOS"}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.featureCard, { backgroundColor: theme.colors.background.secondary }]}>
            <View style={styles.featureHeader}>
              <Ionicons 
                name={canDetectScreenshots ? "eye" : "eye-off"} 
                size={24} 
                color={canDetectScreenshots ? "#2196F3" : theme.colors.text.secondary} 
              />
              <View style={styles.featureInfo}>
                <Text style={[styles.featureTitle, { color: theme.colors.text.primary }]}>
                  iOS Screenshot Detection
                </Text>
                <Text style={[styles.featureStatus, { 
                  color: canDetectScreenshots ? "#2196F3" : theme.colors.text.secondary 
                }]}>
                  {canDetectScreenshots ? "Active - Detects screenshots" : "Not available on Android"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={[styles.infoCard, { backgroundColor: theme.colors.background.tertiary }]}>
            <Ionicons name="information-circle" size={20} color={theme.colors.text.accent} />
            <Text style={[styles.infoText, { color: theme.colors.text.primary }]}>
              All messages are end-to-end encrypted regardless of your verification setting. These options only control how you verify the security of your connections.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.default,
    },
    backButton: {
      padding: theme.spacing.xs,
    },
    headerTitle: {
      ...theme.typography.headlineSmall,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      padding: theme.spacing.md,
    },
    section: {
      marginBottom: theme.spacing.lg,
    },
    sectionTitle: {
      ...theme.typography.headlineSmall,
      fontWeight: '600',
      marginBottom: theme.spacing.sm,
    },
    sectionDescription: {
      ...theme.typography.bodyMedium,
      lineHeight: 20,
    },
    options: {
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
    optionCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      borderWidth: 2,
    },
    selectedCard: {
      // Border color set inline
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.sm,
    },
    optionInfo: {
      flex: 1,
    },
    optionTitle: {
      ...theme.typography.bodyLarge,
      fontWeight: '600',
    },
    optionSubtitle: {
      ...theme.typography.bodySmall,
      marginTop: 2,
    },
    optionDescription: {
      ...theme.typography.bodySmall,
      lineHeight: 18,
    },
    featureCard: {
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    featureHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    featureInfo: {
      marginLeft: theme.spacing.sm,
      flex: 1,
    },
    featureTitle: {
      ...theme.typography.bodyMedium,
      fontWeight: '600',
    },
    featureStatus: {
      ...theme.typography.bodySmall,
      marginTop: 2,
    },
    infoSection: {
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    infoCard: {
      flexDirection: 'row',
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing.sm,
    },
    infoText: {
      ...theme.typography.bodySmall,
      flex: 1,
      lineHeight: 18,
    },
  });
};