import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSecurity } from '../contexts/SecurityContext';
import monetizationAnalytics from '../services/monetizationAnalytics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PremiumSecurityUpsellProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  trigger: 'screenshot_detected' | 'screenshot_blocked' | 'security_dashboard' | 'manual';
  screenshotCount?: number;
}

interface SecurityFeature {
  icon: string;
  title: string;
  description: string;
  platform: 'ios' | 'android' | 'both';
  highlight?: boolean;
}

export default function PremiumSecurityUpsell({
  visible,
  onClose,
  onUpgrade,
  trigger,
  screenshotCount = 0,
}: PremiumSecurityUpsellProps) {
  const theme = useAppTheme();
  const { isPremiumUser } = useSecurity();
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Enhanced handlers with analytics tracking
  const handleClose = () => {
    // Track upsell dismissed
    monetizationAnalytics.trackUpsellDismissed(trigger, {
      screenshotCount,
      platform: Platform.OS as 'ios' | 'android',
      userSegment: isPremiumUser ? 'premium' : 'free',
    });
    onClose();
  };

  const handleUpgrade = () => {
    // Track upgrade button clicked
    monetizationAnalytics.trackUpgradeClicked(trigger, {
      screenshotCount,
      platform: Platform.OS as 'ios' | 'android',
      userSegment: isPremiumUser ? 'premium' : 'free',
    });
    onUpgrade();
  };

  useEffect(() => {
    if (visible) {
      // Track upsell shown
      monetizationAnalytics.trackUpsellShown(trigger, {
        screenshotCount,
        platform: Platform.OS as 'ios' | 'android',
        userSegment: isPremiumUser ? 'premium' : 'free',
      });
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
        // Premium glow effect
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: false,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.3,
              duration: 2000,
              useNativeDriver: false,
            }),
          ])
        ),
        // Security urgency pulse
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 0,
              duration: 1200,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getSecurityFeatures = (): SecurityFeature[] => {
    const baseFeatures: SecurityFeature[] = [
      {
        icon: 'shield-checkmark',
        title: 'Block Screenshots',
        description: 'Completely prevent screenshots on Android devices',
        platform: 'android',
        highlight: Platform.OS === 'android',
      },
      {
        icon: 'eye',
        title: 'Advanced Detection',
        description: 'Instant notifications when screenshots are taken',
        platform: 'ios',
        highlight: Platform.OS === 'ios',
      },
      {
        icon: 'analytics',
        title: 'Security Analytics',
        description: 'Track all screenshot attempts with detailed insights',
        platform: 'both',
      },
      {
        icon: 'phone-portrait',
        title: 'App Blur Protection',
        description: 'Content blurs automatically when switching apps',
        platform: 'both',
      },
      {
        icon: 'lock-closed',
        title: 'Enhanced Encryption',
        description: 'Military-grade protection for your voice messages',
        platform: 'both',
      },
      {
        icon: 'trending-up',
        title: 'Trust Scores',
        description: 'See security metrics for all your conversations',
        platform: 'both',
      },
    ];

    return baseFeatures.filter(
      feature => feature.platform === 'both' || feature.platform === Platform.OS
    );
  };

  const getTriggerContent = () => {
    switch (trigger) {
      case 'screenshot_detected':
        return {
          title: '🚨 Your Message Was Screenshotted',
          subtitle: `${screenshotCount > 1 ? `${screenshotCount} screenshots have` : 'A screenshot has'} been taken of your content`,
          urgencyColor: theme.colors.neon?.neonPink || '#FF1B8D',
          cta: 'Prevent Future Screenshots',
        };
      
      case 'screenshot_blocked':
        return {
          title: '🛡️ Screenshot Blocked Successfully',
          subtitle: 'Your Pro protection is working! Upgrade to keep your content secure.',
          urgencyColor: theme.colors.neon?.cyberBlue || '#00D9FF',
          cta: 'Continue Pro Protection',
        };
      
      case 'security_dashboard':
        return {
          title: '📊 Upgrade Your Security',
          subtitle: 'Get advanced security analytics and complete protection',
          urgencyColor: theme.colors.neon?.electricPurple || '#B026FF',
          cta: 'Unlock Premium Security',
        };
      
      default:
        return {
          title: '🔒 Secure Your Messages',
          subtitle: 'Take control of your privacy with premium security features',
          urgencyColor: theme.colors.neon?.electricPurple || '#B026FF',
          cta: 'Get Premium Protection',
        };
    }
  };

  const triggerContent = getTriggerContent();
  const features = getSecurityFeatures();

  // Screenshot prevention is now free for all users - disable premium upsells
  return null;
  
  // OLD PREMIUM CHECK: if (isPremiumUser) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Cyberpunk glow effect */}
          <Animated.View
            style={[
              styles.glowEffect,
              {
                opacity: glowAnim,
                shadowColor: triggerContent.urgencyColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 30,
                elevation: 30,
              },
            ]}
          />

          <LinearGradient
            colors={[
              theme.colors.background.primary + 'F8',
              theme.colors.background.secondary + 'F0',
              triggerContent.urgencyColor + '20',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>

              {/* Urgency pulse indicator */}
              <Animated.View
                style={[
                  styles.urgencyIndicator,
                  {
                    backgroundColor: triggerContent.urgencyColor,
                    opacity: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                    transform: [{
                      scale: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      })
                    }],
                  },
                ]}
              />
            </View>

            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={[styles.title, { color: theme.colors.text.primary }]}>
                {triggerContent.title}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
                {triggerContent.subtitle}
              </Text>
            </View>

            {/* Features Grid */}
            <View style={styles.featuresContainer}>
              <Text style={[styles.featuresTitle, { color: theme.colors.text.primary }]}>
                Premium Security Features
              </Text>
              
              <View style={styles.featuresGrid}>
                {features.map((feature, index) => (
                  <View
                    key={index}
                    style={[
                      styles.featureItem,
                      {
                        backgroundColor: feature.highlight 
                          ? triggerContent.urgencyColor + '20'
                          : theme.colors.background.tertiary,
                        borderColor: feature.highlight
                          ? triggerContent.urgencyColor
                          : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons
                      name={feature.icon as any}
                      size={20}
                      color={feature.highlight ? triggerContent.urgencyColor : theme.colors.text.accent}
                    />
                    <Text style={[styles.featureTitle, { color: theme.colors.text.primary }]}>
                      {feature.title}
                    </Text>
                    <Text style={[styles.featureDescription, { color: theme.colors.text.secondary }]}>
                      {feature.description}
                    </Text>
                    
                    {feature.highlight && (
                      <View style={[styles.highlightBadge, { backgroundColor: triggerContent.urgencyColor }]}>
                        <Text style={styles.highlightText}>RECOMMENDED</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Pricing */}
            <View style={styles.pricingSection}>
              <View style={styles.priceContainer}>
                <Text style={[styles.price, { color: theme.colors.text.primary }]}>
                  $4.99
                </Text>
                <Text style={[styles.priceUnit, { color: theme.colors.text.secondary }]}>
                  /month
                </Text>
              </View>
              
              <Text style={[styles.pricingDetails, { color: theme.colors.text.tertiary }]}>
                Cancel anytime • 7-day free trial • {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} billing
              </Text>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: triggerContent.urgencyColor }]}
              onPress={handleUpgrade}
            >
              <LinearGradient
                colors={[triggerContent.urgencyColor, triggerContent.urgencyColor + 'DD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Ionicons name="shield" size={20} color="#FFFFFF" />
                <Text style={styles.upgradeButtonText}>
                  {triggerContent.cta}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Platform indicator */}
            <View style={styles.platformInfo}>
              <Ionicons
                name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-android'}
                size={16}
                color={theme.colors.text.tertiary}
              />
              <Text style={[styles.platformText, { color: theme.colors.text.tertiary }]}>
                {Platform.OS === 'ios' 
                  ? 'Detection + Notifications on iOS'
                  : 'Complete Screenshot Blocking on Android'
                }
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  glowEffect: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 32,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 4,
  },
  urgencyIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  titleSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 100,
    position: 'relative',
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  highlightBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  highlightText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  pricingSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  priceUnit: {
    fontSize: 16,
    marginLeft: 4,
  },
  pricingDetails: {
    fontSize: 12,
    textAlign: 'center',
  },
  upgradeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  platformText: {
    fontSize: 12,
    fontWeight: '500',
  },
});