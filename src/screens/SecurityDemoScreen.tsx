import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSecurityNotifications } from '../components/SecurityNotificationManager';
import SecurityNotificationManager from '../components/SecurityNotificationManager';
import SecurityAnalyticsDashboard from '../components/SecurityAnalyticsDashboard';
import SecurityTrustScore from '../components/SecurityTrustScore';
import MessageBubble from '../components/MessageBubble';

export default function SecurityDemoScreen() {
  const theme = useAppTheme();
  const { triggerScreenshotDetected, managerRef } = useSecurityNotifications();
  const [showAnalytics, setShowAnalytics] = useState(false);

  const handleTriggerVoiceScreenshot = () => {
    triggerScreenshotDetected('voice', 'demo-voice-message-1');
  };

  const handleTriggerVideoScreenshot = () => {
    triggerScreenshotDetected('video', 'demo-video-message-1');
  };

  const handleNavigateToSecurity = () => {
    console.log('Navigate to security screen');
    setShowAnalytics(true);
  };

  const handleNavigateToPremium = () => {
    console.log('Navigate to premium purchase screen');
  };

  const handleUpgrade = () => {
    console.log('Start premium upgrade flow');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      {/* Security Notification Manager - Handles all notifications globally */}
      <SecurityNotificationManager
        ref={managerRef}
        onNavigateToSecurity={handleNavigateToSecurity}
        onNavigateToPremium={handleNavigateToPremium}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            Security UX Demo
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
            Premium notification system for screenshot detection
          </Text>
        </View>

        {/* Demo Controls */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Trigger Demo Notifications
          </Text>

          <TouchableOpacity
            style={[styles.demoButton, { backgroundColor: theme.colors.neon?.neonPink + '20', borderColor: theme.colors.neon?.neonPink }]}
            onPress={handleTriggerVoiceScreenshot}
          >
            <Ionicons name="mic" size={20} color={theme.colors.neon?.neonPink} />
            <Text style={[styles.buttonText, { color: theme.colors.neon?.neonPink }]}>
              Voice Message Screenshot
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.demoButton, { backgroundColor: theme.colors.neon?.cyberBlue + '20', borderColor: theme.colors.neon?.cyberBlue }]}
            onPress={handleTriggerVideoScreenshot}
          >
            <Ionicons name="videocam" size={20} color={theme.colors.neon?.cyberBlue} />
            <Text style={[styles.buttonText, { color: theme.colors.neon?.cyberBlue }]}>
              Video Message Screenshot
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.demoButton, { backgroundColor: theme.colors.neon?.electricPurple + '20', borderColor: theme.colors.neon?.electricPurple }]}
            onPress={() => setShowAnalytics(!showAnalytics)}
          >
            <Ionicons name="analytics" size={20} color={theme.colors.neon?.electricPurple} />
            <Text style={[styles.buttonText, { color: theme.colors.neon?.electricPurple }]}>
              {showAnalytics ? 'Hide' : 'Show'} Analytics Dashboard
            </Text>
          </TouchableOpacity>
        </View>

        {/* Security Trust Score Examples */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Security Trust Indicators
          </Text>

          <View style={[styles.trustExamples, { backgroundColor: theme.colors.background.secondary }]}>
            <View style={styles.trustExample}>
              <Text style={[styles.exampleLabel, { color: theme.colors.text.secondary }]}>
                Secure Message (0 screenshots)
              </Text>
              <SecurityTrustScore
                screenshotAttempts={0}
                messageType="voice"
                variant="badge"
                size="medium"
                showLabel={true}
              />
            </View>

            <View style={styles.trustExample}>
              <Text style={[styles.exampleLabel, { color: theme.colors.text.secondary }]}>
                Monitored Message (2 screenshots)
              </Text>
              <SecurityTrustScore
                screenshotAttempts={2}
                messageType="video"
                variant="badge"
                size="medium"
                showLabel={true}
              />
            </View>

            <View style={styles.trustExample}>
              <Text style={[styles.exampleLabel, { color: theme.colors.text.secondary }]}>
                Compromised Message (5 screenshots)
              </Text>
              <SecurityTrustScore
                screenshotAttempts={5}
                messageType="voice"
                variant="badge"
                size="medium"
                showLabel={true}
              />
            </View>
          </View>
        </View>

        {/* Message Bubble Examples */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Enhanced Message Bubbles
          </Text>

          <View style={styles.messageExamples}>
            <MessageBubble
              content="This voice message has been secure"
              isMine={true}
              timestamp={new Date()}
              messageType="voice"
              status="read"
              screenshotAttempts={0}
              showSecurityTrustScore={true}
            />

            <MessageBubble
              content="This video message was screenshotted twice"
              isMine={true}
              timestamp={new Date()}
              messageType="video"
              status="read"
              screenshotAttempts={2}
              showSecurityTrustScore={true}
            />
          </View>
        </View>

        {/* Analytics Dashboard */}
        {showAnalytics && (
          <View style={styles.section}>
            <SecurityAnalyticsDashboard
              onUpgrade={handleUpgrade}
              showHeader={true}
              compactMode={false}
            />
          </View>
        )}

        {/* Feature List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Security UX Features
          </Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="notifications" size={20} color={theme.colors.neon?.neonPink} />
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: theme.colors.text.primary }]}>
                  Premium Notifications
                </Text>
                <Text style={[styles.featureDescription, { color: theme.colors.text.secondary }]}>
                  Beautiful cyberpunk-themed notifications with platform-specific messaging
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={20} color={theme.colors.neon?.cyberBlue} />
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: theme.colors.text.primary }]}>
                  Trust Indicators
                </Text>
                <Text style={[styles.featureDescription, { color: theme.colors.text.secondary }]}>
                  Visual security metrics showing screenshot attempts and trust scores
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="trending-up" size={20} color={theme.colors.neon?.electricPurple} />
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: theme.colors.text.primary }]}>
                  Premium Upsells
                </Text>
                <Text style={[styles.featureDescription, { color: theme.colors.text.secondary }]}>
                  Context-aware conversion flows triggered by security events
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Ionicons name="analytics" size={20} color={theme.colors.neon?.matrixGreen} />
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: theme.colors.text.primary }]}>
                  Security Dashboard
                </Text>
                <Text style={[styles.featureDescription, { color: theme.colors.text.secondary }]}>
                  Comprehensive security analytics with real-time metrics
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  trustExamples: {
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  trustExample: {
    alignItems: 'center',
    gap: 8,
  },
  exampleLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  messageExamples: {
    gap: 12,
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});