import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure how notifications are displayed
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class PushNotificationService {
  private static instance: PushNotificationService;
  
  private constructor() {}
  
  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  // Register for push notifications
  async registerForPushNotifications(userId: string): Promise<string | null> {
    try {
      // Check if we're on a physical device
      if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return null;
      }

      // Check if we're in Expo Go with SDK 53+
      const isExpoGo = Constants.appOwnership === 'expo';
      const sdkVersion = parseInt(Constants.expoConfig?.sdkVersion || '0');
      
      if (isExpoGo && sdkVersion >= 53) {
        console.warn('Push notifications are not supported in Expo Go for SDK 53+');
        console.warn('Please use a development build. See DEVELOPMENT_BUILD_SETUP.md');
        // Return a mock token for testing purposes
        const mockToken = `ExponentPushToken[MOCK-${userId.substring(0, 8)}]`;
        console.log('Using mock token for testing:', mockToken);
        // Don't save mock tokens to database
        return null;
      }

      // Get existing permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return null;
      }

      // Get the push token
      let token;
      
      console.log('App ownership:', Constants.appOwnership);
      console.log('SDK Version:', sdkVersion);
      
      if (isExpoGo) {
        // This won't work in SDK 53+ but keeping for older SDKs
        const experienceId = `@${Constants.expoConfig?.owner || 'micksolo'}/${Constants.expoConfig?.slug || 'VanishVoice'}`;
        console.log('Using experienceId for Expo Go:', experienceId);
        
        token = await Notifications.getExpoPushTokenAsync({
          experienceId: experienceId
        });
      } else {
        // In standalone/development builds
        token = await Notifications.getExpoPushTokenAsync();
      }

      console.log('Push token:', token.data);

      // Save token to database
      await this.savePushToken(userId, token.data);

      // Save token locally for reference
      await AsyncStorage.setItem('vanishvoice_push_token', token.data);

      return token.data;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  // Save push token to database
  private async savePushToken(userId: string, token: string): Promise<void> {
    try {
      const platform = Platform.OS as 'ios' | 'android';
      
      // Debug: Check current session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session when saving token:', session?.user?.id);
      console.log('Session exists:', !!session);
      console.log('Session user:', session?.user);
      console.log('Trying to save token for userId:', userId);
      
      if (!session || session.user?.id !== userId) {
        console.error('Session mismatch! Session userId:', session?.user?.id, 'Provided userId:', userId);
      }
      
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token,
          platform,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,token'
        });

      if (error) throw error;
      
      console.log('Push token saved successfully');
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  // Remove push token (on logout)
  async removePushToken(userId: string): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('vanishvoice_push_token');
      
      if (token) {
        const { error } = await supabase
          .from('push_tokens')
          .delete()
          .eq('user_id', userId)
          .eq('token', token);

        if (error) throw error;
        
        await AsyncStorage.removeItem('vanishvoice_push_token');
      }
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  }

  // Listen for notification interactions
  setupNotificationListeners() {
    // This listener is fired whenever a notification is received while the app is foregrounded
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // This listener is fired whenever a user taps on or interacts with a notification
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Navigate to the appropriate screen based on notification data
      const data = response.notification.request.content.data;
      if (data.type === 'new_message') {
        // Navigate to messages screen
        // You'll need to implement navigation here
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }

  // Schedule a local notification (for testing)
  async scheduleLocalNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: { seconds: 1 },
    });
  }
}

export default PushNotificationService.getInstance();