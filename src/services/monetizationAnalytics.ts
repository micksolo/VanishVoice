import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Types for monetization tracking
interface MonetizationEvent {
  id: string;
  eventType: 'upsell_shown' | 'upsell_dismissed' | 'upgrade_clicked' | 'conversion' | 'screenshot_trigger';
  trigger: 'screenshot_detected' | 'screenshot_blocked' | 'security_dashboard' | 'manual' | 'other';
  timestamp: Date;
  context?: {
    screenshotCount?: number;
    messageType?: 'voice' | 'video' | 'text';
    platform?: 'ios' | 'android';
    userSegment?: 'free' | 'premium';
    sessionId?: string;
  };
  metadata?: Record<string, any>;
}

interface AnalyticsSession {
  sessionId: string;
  startTime: Date;
  userId?: string;
  platform: 'ios' | 'android';
}

const ANALYTICS_STORAGE_KEY = '@wyd_monetization_analytics';
const SESSION_STORAGE_KEY = '@wyd_analytics_session';
const MAX_CACHED_EVENTS = 100;

class MonetizationAnalyticsService {
  private currentSession: AnalyticsSession | null = null;
  private cachedEvents: MonetizationEvent[] = [];
  private initialized = false;

  // Initialize analytics session
  async initialize(userId?: string): Promise<void> {
    try {
      if (this.initialized) return;

      // Create new session
      this.currentSession = {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startTime: new Date(),
        userId,
        platform: require('react-native').Platform.OS as 'ios' | 'android',
      };

      // Store session
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.currentSession));

      // Load cached events
      await this.loadCachedEvents();

      this.initialized = true;

      // Log initialization
      if (__DEV__) {
        console.log('[MonetizationAnalytics] Initialized session:', this.currentSession.sessionId);
      }
    } catch (error) {
      console.error('[MonetizationAnalytics] Failed to initialize:', error);
    }
  }

  // Track upsell shown
  async trackUpsellShown(
    trigger: MonetizationEvent['trigger'],
    context?: MonetizationEvent['context']
  ): Promise<void> {
    await this.trackEvent('upsell_shown', trigger, context);
  }

  // Track upsell dismissed
  async trackUpsellDismissed(
    trigger: MonetizationEvent['trigger'],
    context?: MonetizationEvent['context']
  ): Promise<void> {
    await this.trackEvent('upsell_dismissed', trigger, context);
  }

  // Track upgrade button clicked
  async trackUpgradeClicked(
    trigger: MonetizationEvent['trigger'],
    context?: MonetizationEvent['context']
  ): Promise<void> {
    await this.trackEvent('upgrade_clicked', trigger, context);
  }

  // Track successful conversion to premium
  async trackConversion(
    trigger: MonetizationEvent['trigger'],
    context?: MonetizationEvent['context']
  ): Promise<void> {
    await this.trackEvent('conversion', trigger, context);
  }

  // Track screenshot-triggered monetization opportunity
  async trackScreenshotTrigger(
    trigger: MonetizationEvent['trigger'],
    context?: MonetizationEvent['context']
  ): Promise<void> {
    await this.trackEvent('screenshot_trigger', trigger, context);
  }

  // Generic event tracking
  private async trackEvent(
    eventType: MonetizationEvent['eventType'],
    trigger: MonetizationEvent['trigger'],
    context?: MonetizationEvent['context'],
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const event: MonetizationEvent = {
        id: `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType,
        trigger,
        timestamp: new Date(),
        context: {
          ...context,
          sessionId: this.currentSession?.sessionId,
          platform: this.currentSession?.platform,
        },
        metadata,
      };

      // Add to cache
      this.cachedEvents.push(event);

      // Limit cache size
      if (this.cachedEvents.length > MAX_CACHED_EVENTS) {
        this.cachedEvents = this.cachedEvents.slice(-MAX_CACHED_EVENTS);
      }

      // Save to local storage
      await this.saveCachedEvents();

      // Send to backend (optional)
      await this.sendEventToBackend(event);

      // Log in development
      if (__DEV__) {
        console.log('[MonetizationAnalytics] Event tracked:', {
          type: eventType,
          trigger,
          session: this.currentSession?.sessionId,
        });
      }
    } catch (error) {
      console.error('[MonetizationAnalytics] Failed to track event:', error);
    }
  }

  // Get analytics summary
  async getAnalyticsSummary(): Promise<{
    totalEvents: number;
    upsellShown: number;
    upgradeClicked: number;
    conversions: number;
    conversionRate: number;
    topTriggers: { trigger: string; count: number }[];
  }> {
    try {
      await this.loadCachedEvents();

      const upsellShown = this.cachedEvents.filter(e => e.eventType === 'upsell_shown').length;
      const upgradeClicked = this.cachedEvents.filter(e => e.eventType === 'upgrade_clicked').length;
      const conversions = this.cachedEvents.filter(e => e.eventType === 'conversion').length;
      
      const conversionRate = upsellShown > 0 ? (conversions / upsellShown) * 100 : 0;

      // Count triggers
      const triggerCounts = this.cachedEvents.reduce((acc, event) => {
        acc[event.trigger] = (acc[event.trigger] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topTriggers = Object.entries(triggerCounts)
        .map(([trigger, count]) => ({ trigger, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalEvents: this.cachedEvents.length,
        upsellShown,
        upgradeClicked,
        conversions,
        conversionRate,
        topTriggers,
      };
    } catch (error) {
      console.error('[MonetizationAnalytics] Failed to get summary:', error);
      return {
        totalEvents: 0,
        upsellShown: 0,
        upgradeClicked: 0,
        conversions: 0,
        conversionRate: 0,
        topTriggers: [],
      };
    }
  }

  // Get recent events
  async getRecentEvents(limit: number = 20): Promise<MonetizationEvent[]> {
    try {
      await this.loadCachedEvents();
      return this.cachedEvents
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('[MonetizationAnalytics] Failed to get recent events:', error);
      return [];
    }
  }

  // Clear all analytics data
  async clearAnalyticsData(): Promise<void> {
    try {
      this.cachedEvents = [];
      await AsyncStorage.removeItem(ANALYTICS_STORAGE_KEY);
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      this.currentSession = null;
      this.initialized = false;
      
      if (__DEV__) {
        console.log('[MonetizationAnalytics] Analytics data cleared');
      }
    } catch (error) {
      console.error('[MonetizationAnalytics] Failed to clear analytics data:', error);
    }
  }

  // Private: Load cached events from storage
  private async loadCachedEvents(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ANALYTICS_STORAGE_KEY);
      if (stored) {
        const events = JSON.parse(stored);
        this.cachedEvents = events.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        }));
      }
    } catch (error) {
      console.error('[MonetizationAnalytics] Failed to load cached events:', error);
      this.cachedEvents = [];
    }
  }

  // Private: Save cached events to storage
  private async saveCachedEvents(): Promise<void> {
    try {
      await AsyncStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(this.cachedEvents));
    } catch (error) {
      console.error('[MonetizationAnalytics] Failed to save cached events:', error);
    }
  }

  // Private: Send event to backend (optional)
  private async sendEventToBackend(event: MonetizationEvent): Promise<void> {
    try {
      // Only send in production or when explicitly enabled
      if (__DEV__ && !process.env.EXPO_PUBLIC_ENABLE_ANALYTICS) {
        return;
      }

      // Send to Supabase analytics table (if exists)
      const { error } = await supabase
        .from('monetization_analytics')
        .insert({
          event_id: event.id,
          event_type: event.eventType,
          trigger: event.trigger,
          timestamp: event.timestamp.toISOString(),
          context: event.context || {},
          metadata: event.metadata || {},
          user_id: this.currentSession?.userId,
          session_id: this.currentSession?.sessionId,
        });

      if (error && error.code !== 'PGRST116') { // Ignore if table doesn't exist
        console.warn('[MonetizationAnalytics] Backend tracking failed:', error.message);
      }
    } catch (error) {
      // Silently fail - analytics shouldn't break the app
      if (__DEV__) {
        console.warn('[MonetizationAnalytics] Backend tracking error:', error);
      }
    }
  }
}

// Create singleton instance
const monetizationAnalytics = new MonetizationAnalyticsService();

export default monetizationAnalytics;
export type { MonetizationEvent, AnalyticsSession };