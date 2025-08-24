import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../contexts/ThemeContext';
import { useSecurity, ScreenshotAttempt } from '../contexts/SecurityContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SecurityMetric {
  id: string;
  title: string;
  value: number;
  subtitle: string;
  icon: string;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
}

interface SecurityAnalyticsDashboardProps {
  onUpgrade?: () => void;
  showHeader?: boolean;
  compactMode?: boolean;
}

export default function SecurityAnalyticsDashboard({
  onUpgrade,
  showHeader = true,
  compactMode = false,
}: SecurityAnalyticsDashboardProps) {
  const theme = useAppTheme();
  const { isPremiumUser, screenshotAttempts, getScreenshotHistory } = useSecurity();
  
  const [attempts, setAttempts] = useState<ScreenshotAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnims = useRef<Record<string, Animated.Value>>({}).current;

  useEffect(() => {
    loadSecurityData();
    
    // Premium glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.2,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const loadSecurityData = async () => {
    try {
      const history = await getScreenshotHistory();
      setAttempts(history);
    } catch (error) {
      console.error('[SecurityDashboard] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSecurityMetrics = (): SecurityMetric[] => {
    const last7Days = attempts.filter(
      attempt => 
        new Date().getTime() - attempt.detectedAt.getTime() < 7 * 24 * 60 * 60 * 1000
    );
    
    const last30Days = attempts.filter(
      attempt => 
        new Date().getTime() - attempt.detectedAt.getTime() < 30 * 24 * 60 * 60 * 1000
    );

    const voiceAttempts = attempts.filter(
      attempt => attempt.context?.messageType === 'voice'
    );
    
    const videoAttempts = attempts.filter(
      attempt => attempt.context?.messageType === 'video'
    );

    return [
      {
        id: 'total-attempts',
        title: 'Screenshot Attempts',
        value: attempts.length,
        subtitle: 'All time',
        icon: 'camera',
        color: theme.colors.neon?.neonPink || '#FF1B8D',
        trend: last7Days.length > 0 ? 'up' : 'neutral',
        trendValue: last7Days.length,
      },
      {
        id: 'weekly-attempts',
        title: 'This Week',
        value: last7Days.length,
        subtitle: 'Last 7 days',
        icon: 'calendar',
        color: theme.colors.neon?.cyberBlue || '#00D9FF',
        trend: last7Days.length > last30Days.length / 4 ? 'up' : 'down',
        trendValue: Math.round((last7Days.length / Math.max(last30Days.length / 4, 1) - 1) * 100),
      },
      {
        id: 'voice-security',
        title: 'Voice Protection',
        value: voiceAttempts.length,
        subtitle: 'Screenshots detected',
        icon: 'mic',
        color: theme.colors.neon?.electricPurple || '#B026FF',
        trend: 'neutral',
      },
      {
        id: 'video-security',
        title: 'Video Protection',
        value: videoAttempts.length,
        subtitle: 'Screenshots detected',
        icon: 'videocam',
        color: theme.colors.neon?.matrixGreen || '#39FF14',
        trend: 'neutral',
      },
    ];
  };

  const animateMetric = (metricId: string) => {
    if (!pulseAnims[metricId]) {
      pulseAnims[metricId] = new Animated.Value(0);
    }

    Animated.sequence([
      Animated.timing(pulseAnims[metricId], {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnims[metricId], {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const metrics = getSecurityMetrics();

  const renderMetricCard = (metric: SecurityMetric, index: number) => (
    <TouchableOpacity
      key={metric.id}
      style={[
        styles.metricCard,
        compactMode && styles.compactCard,
        { backgroundColor: theme.colors.background.secondary },
      ]}
      onPress={() => animateMetric(metric.id)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[
          metric.color + '20',
          metric.color + '10',
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricGradient}
      >
        <Animated.View
          style={[
            styles.metricContent,
            pulseAnims[metric.id] && {
              transform: [{
                scale: pulseAnims[metric.id]?.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.05],
                }) || 1
              }]
            }
          ]}
        >
          {/* Icon */}
          <View style={[styles.metricIcon, { backgroundColor: metric.color + '20' }]}>
            <Ionicons
              name={metric.icon as any}
              size={compactMode ? 20 : 24}
              color={metric.color}
            />
          </View>

          {/* Value */}
          <Text
            style={[
              styles.metricValue,
              compactMode && styles.compactValue,
              { color: theme.colors.text.primary },
            ]}
          >
            {metric.value}
          </Text>

          {/* Title */}
          <Text
            style={[
              styles.metricTitle,
              compactMode && styles.compactTitle,
              { color: theme.colors.text.secondary },
            ]}
          >
            {metric.title}
          </Text>

          {/* Subtitle */}
          <Text
            style={[
              styles.metricSubtitle,
              compactMode && styles.compactSubtitle,
              { color: theme.colors.text.tertiary },
            ]}
          >
            {metric.subtitle}
          </Text>

          {/* Trend indicator */}
          {metric.trend && metric.trend !== 'neutral' && metric.trendValue && (
            <View style={styles.trendContainer}>
              <Ionicons
                name={metric.trend === 'up' ? 'trending-up' : 'trending-down'}
                size={12}
                color={metric.trend === 'up' ? theme.colors.status.error : theme.colors.status.success}
              />
              <Text
                style={[
                  styles.trendText,
                  {
                    color: metric.trend === 'up' ? theme.colors.status.error : theme.colors.status.success,
                  },
                ]}
              >
                {Math.abs(metric.trendValue)}%
              </Text>
            </View>
          )}
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderPremiumUpsell = () => (
    <TouchableOpacity
      style={[
        styles.upsellCard,
        { 
          backgroundColor: theme.colors.background.secondary,
          borderColor: theme.colors.neon?.electricPurple || '#B026FF',
        },
      ]}
      onPress={onUpgrade}
    >
      <Animated.View
        style={[
          styles.upsellGlow,
          {
            opacity: glowAnim,
            shadowColor: theme.colors.neon?.electricPurple || '#B026FF',
          },
        ]}
      />
      
      <LinearGradient
        colors={[
          (theme.colors.neon?.electricPurple || '#B026FF') + '30',
          (theme.colors.neon?.electricPurple || '#B026FF') + '10',
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.upsellGradient}
      >
        <View style={styles.upsellContent}>
          <View style={styles.upsellHeader}>
            <View style={[styles.premiumIcon, { backgroundColor: theme.colors.neon?.electricPurple + '20' }]}>
              <Ionicons
                name="diamond"
                size={24}
                color={theme.colors.neon?.electricPurple || '#B026FF'}
              />
            </View>
            <View style={styles.upsellText}>
              <Text style={[styles.upsellTitle, { color: theme.colors.text.primary }]}>
                Upgrade to Pro
              </Text>
              <Text style={[styles.upsellSubtitle, { color: theme.colors.text.secondary }]}>
                Get advanced security analytics
              </Text>
            </View>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={theme.colors.neon?.electricPurple || '#B026FF'}
            />
          </View>

          <View style={styles.premiumFeatures}>
            <View style={styles.premiumFeature}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.neon?.cyberBlue} />
              <Text style={[styles.premiumFeatureText, { color: theme.colors.text.secondary }]}>
                Screenshot blocking (Android)
              </Text>
            </View>
            <View style={styles.premiumFeature}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.neon?.cyberBlue} />
              <Text style={[styles.premiumFeatureText, { color: theme.colors.text.secondary }]}>
                Advanced trust metrics
              </Text>
            </View>
            <View style={styles.premiumFeature}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.neon?.cyberBlue} />
              <Text style={[styles.premiumFeatureText, { color: theme.colors.text.secondary }]}>
                Real-time threat alerts
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderRecentActivity = () => {
    const recentAttempts = attempts.slice(0, compactMode ? 3 : 5);

    return (
      <View style={styles.activitySection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          Recent Activity
        </Text>
        
        {recentAttempts.length > 0 ? (
          recentAttempts.map((attempt, index) => (
            <View
              key={attempt.id}
              style={[
                styles.activityItem,
                { backgroundColor: theme.colors.background.tertiary },
              ]}
            >
              <View style={[styles.activityIcon, { backgroundColor: theme.colors.neon?.neonPink + '20' }]}>
                <Ionicons
                  name="camera"
                  size={16}
                  color={theme.colors.neon?.neonPink || '#FF1B8D'}
                />
              </View>
              
              <View style={styles.activityContent}>
                <Text style={[styles.activityTitle, { color: theme.colors.text.primary }]}>
                  Screenshot Detected
                </Text>
                <Text style={[styles.activitySubtitle, { color: theme.colors.text.secondary }]}>
                  {attempt.context?.messageType || 'Unknown'} message • {Platform.OS}
                </Text>
              </View>
              
              <Text style={[styles.activityTime, { color: theme.colors.text.tertiary }]}>
                {attempt.detectedAt.toLocaleDateString()}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.noActivity}>
            <Ionicons
              name="shield-checkmark"
              size={32}
              color={theme.colors.neon?.cyberBlue || '#00D9FF'}
            />
            <Text style={[styles.noActivityTitle, { color: theme.colors.text.primary }]}>
              All Secure
            </Text>
            <Text style={[styles.noActivitySubtitle, { color: theme.colors.text.secondary }]}>
              No screenshot attempts detected
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Ionicons
          name="shield-checkmark"
          size={32}
          color={theme.colors.text.accent}
        />
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
          Loading security data...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, compactMode && styles.compactContainer]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      {showHeader && (
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
            Security Analytics
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.text.secondary }]}>
            Monitor your message security
          </Text>
        </View>
      )}

      {/* Metrics Grid */}
      <View style={[styles.metricsGrid, compactMode && styles.compactGrid]}>
        {metrics.map((metric, index) => renderMetricCard(metric, index))}
      </View>

      {/* Premium Upsell (for non-premium users) */}
      {!isPremiumUser && onUpgrade && renderPremiumUpsell()}

      {/* Recent Activity */}
      {!compactMode && renderRecentActivity()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  compactContainer: {
    padding: 12,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  compactGrid: {
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 44) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 120,
  },
  compactCard: {
    minHeight: 100,
  },
  metricGradient: {
    flex: 1,
    padding: 16,
  },
  metricContent: {
    alignItems: 'center',
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  compactValue: {
    fontSize: 20,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  compactTitle: {
    fontSize: 12,
  },
  metricSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  compactSubtitle: {
    fontSize: 10,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  upsellCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  upsellGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 20,
  },
  upsellGradient: {
    padding: 16,
  },
  upsellContent: {},
  upsellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  premiumIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  upsellText: {
    flex: 1,
  },
  upsellTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  upsellSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  premiumFeatures: {
    gap: 8,
  },
  premiumFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  premiumFeatureText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activitySection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  noActivity: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noActivityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  noActivitySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});