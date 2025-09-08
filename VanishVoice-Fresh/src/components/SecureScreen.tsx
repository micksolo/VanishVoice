import React, { useEffect, ReactNode } from 'react';
import { View, StyleSheet, Platform, Modal, Text, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSecurity } from '../contexts/SecurityContext';
import useScreenshotSecurity from '../hooks/useScreenshotSecurity';
import SecurityShield from './SecurityShield';

interface SecureScreenProps {
  children: ReactNode;
  screenName?: string;
  showSecurityIndicator?: boolean;
  showEducation?: boolean;
  messageId?: string;
}

export default function SecureScreen({
  children,
  screenName = 'SecureContent',
  showSecurityIndicator = true,
  showEducation = false,
  messageId,
}: SecureScreenProps) {
  const theme = useAppTheme();
  const { isSecureModeEnabled, isPremiumUser } = useSecurity();
  const [showEducationModal, setShowEducationModal] = React.useState(false);
  const [screenshotDetected, setScreenshotDetected] = React.useState(false);
  
  // Use screenshot security hook
  const { isSecure, canPrevent, canDetect } = useScreenshotSecurity({
    enabled: isSecureModeEnabled,
    sensitiveContent: true,
    screenName,
    messageId,
    onScreenshotDetected: (timestamp) => {
      if (__DEV__) {
        console.log(`[SecureScreen] Screenshot detected at ${timestamp}`);
      }
      setScreenshotDetected(true);
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => {
        setScreenshotDetected(false);
      }, 3000);
    },
  });
  
  // Show education modal on first use
  useEffect(() => {
    if (showEducation && isSecureModeEnabled) {
      // Check if user has seen education before
      // For now, we'll skip this check
      // setShowEducationModal(true);
    }
  }, [showEducation, isSecureModeEnabled]);
  
  return (
    <View style={styles.container}>
      {/* Main content */}
      {children}
      
      {/* Security indicator overlay */}
      {showSecurityIndicator && isSecureModeEnabled && (
        <View style={styles.securityIndicator}>
          <SecurityShield
            isActive={isSecure}
            size="medium"
            showLabel={false}
            onPress={() => setShowEducationModal(true)}
          />
        </View>
      )}
      
      {/* Screenshot detection notification (iOS) */}
      {screenshotDetected && Platform.OS === 'ios' && (
        <View style={[styles.screenshotNotification, { backgroundColor: theme.colors.neon?.neonPink || '#FF1B8D' }]}>
          <Ionicons name="camera" size={20} color="#FFFFFF" />
          <Text style={[styles.notificationText, theme.typography.bodyMedium]}>
            Screenshot Detected
          </Text>
          {!isPremiumUser && (
            <TouchableOpacity
              onPress={() => {
                // TODO: Navigate to premium screen
                if (__DEV__) {
                  console.log('[SecureScreen] Navigate to premium');
                }
              }}
              style={styles.upgradeButton}
            >
              <Text style={styles.upgradeText}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Security Education Modal */}
      <Modal
        visible={showEducationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEducationModal(false)}
      >
        <BlurView intensity={90} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background.secondary }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <SecurityShield size="large" isActive />
              <Text style={[styles.modalTitle, theme.typography.headlineMedium, { color: theme.colors.text.primary }]}>
                Screenshot Protection
              </Text>
            </View>
            
            {/* Platform-specific information */}
            <View style={styles.infoSection}>
              {Platform.OS === 'android' ? (
                <>
                  <View style={styles.infoRow}>
                    <Ionicons name="shield-checkmark" size={24} color={theme.colors.neon?.cyberBlue || '#00D9FF'} />
                    <Text style={[styles.infoText, theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>
                      Screenshots are {isPremiumUser ? 'BLOCKED' : 'DETECTED'} on this device
                    </Text>
                  </View>
                  {isPremiumUser && (
                    <Text style={[styles.infoSubtext, theme.typography.bodySmall, { color: theme.colors.text.tertiary }]}>
                      Screen recording is also prevented while viewing sensitive content
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Ionicons name="eye" size={24} color={theme.colors.neon?.neonPink || '#FF1B8D'} />
                    <Text style={[styles.infoText, theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>
                      Screenshots are DETECTED and logged
                    </Text>
                  </View>
                  <Text style={[styles.infoSubtext, theme.typography.bodySmall, { color: theme.colors.text.tertiary }]}>
                    You'll be notified when someone takes a screenshot
                  </Text>
                </>
              )}
            </View>
            
            {/* Premium upsell for free users */}
            {!isPremiumUser && (
              <View style={[styles.premiumCard, { borderColor: theme.colors.neon?.electricPurple || '#B026FF' }]}>
                <Text style={[styles.premiumTitle, theme.typography.bodyLarge, { color: theme.colors.text.primary }]}>
                  Upgrade to Premium
                </Text>
                <View style={styles.premiumFeatures}>
                  <Text style={[styles.featureItem, { color: theme.colors.text.secondary }]}>
                    ✓ Block screenshots completely (Android)
                  </Text>
                  <Text style={[styles.featureItem, { color: theme.colors.text.secondary }]}>
                    ✓ Blur protection when backgrounded (iOS)
                  </Text>
                  <Text style={[styles.featureItem, { color: theme.colors.text.secondary }]}>
                    ✓ Screenshot analytics dashboard
                  </Text>
                  <Text style={[styles.featureItem, { color: theme.colors.text.secondary }]}>
                    ✓ Advanced trust scores
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.premiumButton, { backgroundColor: theme.colors.neon?.electricPurple || '#B026FF' }]}
                  onPress={() => {
                    // TODO: Navigate to premium
                    if (__DEV__) {
                      console.log('[SecureScreen] Navigate to premium subscription');
                    }
                  }}
                >
                  <Text style={styles.premiumButtonText}>Get Premium - $4.99/mo</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Close button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowEducationModal(false)}
            >
              <Text style={[styles.closeButtonText, { color: theme.colors.text.accent }]}>
                Got it
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  securityIndicator: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 100,
  },
  screenshotNotification: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationText: {
    flex: 1,
    marginLeft: 8,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  upgradeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    marginTop: 12,
    fontWeight: 'bold',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoSubtext: {
    marginLeft: 36,
    marginTop: 4,
    opacity: 0.8,
  },
  premiumCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  premiumTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  premiumFeatures: {
    marginBottom: 16,
  },
  featureItem: {
    fontSize: 14,
    marginBottom: 6,
  },
  premiumButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  premiumButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});