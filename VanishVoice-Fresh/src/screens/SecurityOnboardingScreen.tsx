import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSecurity } from '../contexts/SecurityContext';
import SecurityShield from '../components/SecurityShield';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDING_COMPLETE_KEY = '@wyd_security_onboarding_complete';

interface SecurityFeature {
  icon: string;
  title: string;
  description: string;
  platform: 'both' | 'ios' | 'android';
  isPremium: boolean;
}

const features: SecurityFeature[] = [
  {
    icon: 'shield-checkmark',
    title: 'Screenshot Prevention',
    description: 'Completely blocks screenshots on Android devices',
    platform: 'android',
    isPremium: false,
  },
  {
    icon: 'eye',
    title: 'Screenshot Detection',
    description: 'Get notified when someone takes a screenshot',
    platform: 'ios',
    isPremium: false,
  },
  {
    icon: 'phone-portrait',
    title: 'App Backgrounding',
    description: 'Content blurs when you switch apps',
    platform: 'both',
    isPremium: false,
  },
  {
    icon: 'analytics',
    title: 'Security Analytics',
    description: 'Track screenshot attempts and security events',
    platform: 'both',
    isPremium: false,
  },
  {
    icon: 'shield',
    title: 'Trust Indicators',
    description: 'Visual badges showing your protection level',
    platform: 'both',
    isPremium: false,
  },
  {
    icon: 'lock-closed',
    title: 'End-to-End Encryption',
    description: 'All messages are encrypted before sending',
    platform: 'both',
    isPremium: false,
  },
];

export default function SecurityOnboardingScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation();
  const { enableSecureMode, isPremiumUser } = useSecurity();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const scrollViewRef = React.useRef<ScrollView>(null);

  const pages = [
    {
      title: 'Your Privacy Matters',
      subtitle: 'VanishVoice protects your conversations',
      content: (
        <View style={styles.pageContent}>
          <SecurityShield size="large" isActive showLabel />
          <Text style={[styles.pageText, { color: theme.colors.text.secondary }]}>
            We use advanced security features to keep your messages private and secure.
          </Text>
        </View>
      ),
    },
    {
      title: 'Platform-Specific Protection',
      subtitle: 'Different features for iOS and Android',
      content: (
        <View style={styles.pageContent}>
          <View style={styles.platformComparison}>
            <View style={styles.platformCard}>
              <Ionicons name="logo-apple" size={32} color={theme.colors.text.primary} />
              <Text style={[styles.platformTitle, { color: theme.colors.text.primary }]}>iOS</Text>
              <Text style={[styles.platformFeature, { color: theme.colors.text.secondary }]}>
                • Screenshot detection{'\n'}
                • Instant notifications{'\n'}
                • Blur on app switch
              </Text>
            </View>
            <View style={styles.platformCard}>
              <Ionicons name="logo-android" size={32} color={theme.colors.neon?.laserGreen || '#00FF88'} />
              <Text style={[styles.platformTitle, { color: theme.colors.text.primary }]}>Android</Text>
              <Text style={[styles.platformFeature, { color: theme.colors.text.secondary }]}>
                • Block screenshots{'\n'}
                • Prevent recording{'\n'}
                • Complete protection
              </Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      title: 'Security Features',
      subtitle: 'What we protect',
      content: (
        <ScrollView style={styles.featuresList} showsVerticalScrollIndicator={false}>
          {features.map((feature, index) => (
            <View
              key={index}
              style={[
                styles.featureItem,
                { backgroundColor: theme.colors.background.secondary }
              ]}
            >
              <View style={styles.featureIcon}>
                <Ionicons
                  name={feature.icon as any}
                  size={24}
                  color={feature.isPremium ? theme.colors.neon?.electricPurple : theme.colors.neon?.cyberBlue}
                />
              </View>
              <View style={styles.featureContent}>
                <View style={styles.featureTitleRow}>
                  <Text style={[styles.featureTitle, { color: theme.colors.text.primary }]}>
                    {feature.title}
                  </Text>
                  {feature.isPremium && (
                    <View style={[styles.premiumBadge, { backgroundColor: theme.colors.neon?.electricPurple || '#B026FF' }]}>
                      <Text style={styles.premiumBadgeText}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.featureDescription, { color: theme.colors.text.secondary }]}>
                  {feature.description}
                </Text>
                <View style={styles.platformTags}>
                  {(feature.platform === 'both' || feature.platform === 'ios') && (
                    <View style={[styles.platformTag, { backgroundColor: theme.colors.text.primary + '20' }]}>
                      <Text style={[styles.platformTagText, { color: theme.colors.text.primary }]}>iOS</Text>
                    </View>
                  )}
                  {(feature.platform === 'both' || feature.platform === 'android') && (
                    <View style={[styles.platformTag, { backgroundColor: theme.colors.neon?.laserGreen + '20' }]}>
                      <Text style={[styles.platformTagText, { color: theme.colors.neon?.laserGreen }]}>Android</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ),
    },
    {
      title: 'Ready to Get Started?',
      subtitle: 'Enable security features now',
      content: (
        <View style={styles.pageContent}>
          <SecurityShield size="large" isActive />
          <Text style={[styles.finalText, { color: theme.colors.text.secondary }]}>
            {Platform.OS === 'ios'
              ? "We'll detect and notify you of any screenshot attempts"
              : "Screenshots will be completely blocked on your Android device"}
          </Text>
        </View>
      ),
    },
  ];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      const nextPage = currentPage + 1;
      scrollViewRef.current?.scrollTo({ x: SCREEN_WIDTH * nextPage, animated: true });
      setCurrentPage(nextPage);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const handleGetStarted = async () => {
    await enableSecureMode();
    await completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save onboarding status:', error);
      navigation.goBack();
    }
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {pages.map((_, index) => {
          const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity,
                  backgroundColor: theme.colors.neon?.cyberBlue || '#00D9FF',
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={[styles.skipButton, { color: theme.colors.text.accent }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          const page = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentPage(page);
        }}
      >
        {pages.map((page, index) => (
          <View key={index} style={styles.page}>
            <Text style={[styles.title, theme.typography.headlineLarge, { color: theme.colors.text.primary }]}>
              {page.title}
            </Text>
            <Text style={[styles.subtitle, theme.typography.bodyLarge, { color: theme.colors.text.accent }]}>
              {page.subtitle}
            </Text>
            {page.content}
          </View>
        ))}
      </Animated.ScrollView>

      {renderDots()}

      <View style={styles.footer}>
        {currentPage === pages.length - 1 ? (
          <TouchableOpacity
            style={[styles.getStartedButton, { backgroundColor: theme.colors.neon?.cyberBlue || '#00D9FF' }]}
            onPress={handleGetStarted}
          >
            <Text style={styles.getStartedButtonText}>Enable Security</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: theme.colors.text.accent }]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  skipButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  page: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 40,
  },
  pageContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  pageText: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  platformComparison: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
  },
  platformCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    width: '45%',
  },
  platformTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 15,
  },
  platformFeature: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
  },
  featuresList: {
    flex: 1,
    marginTop: 20,
  },
  featureItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  premiumBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  platformTags: {
    flexDirection: 'row',
    gap: 8,
  },
  platformTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  platformTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  premiumButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 30,
    marginBottom: 20,
  },
  premiumButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  finalText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  getStartedButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  getStartedButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

// Helper function to check if onboarding has been completed
export async function hasCompletedSecurityOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

// Helper function to reset onboarding (for testing)
export async function resetSecurityOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  } catch (error) {
    console.error('Failed to reset onboarding:', error);
  }
}