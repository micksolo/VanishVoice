import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface MessageNotificationData {
  type: 'new_message' | 'friend_request';
  sender_id?: string;
  message_id?: string;
  sender_name?: string;
}

// Send push notification via Supabase Edge Function
export async function sendMessageNotification(
  recipientId: string,
  senderId: string,
  senderName: string,
  messageType: 'text' | 'voice' = 'text'
) {
  try {
    // Call Edge Function to send push
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        recipient_id: recipientId,
        title: 'New Message',
        body: `${senderName} sent you a ${messageType} message`,
        data: {
          type: 'new_message',
          sender_id: senderId,
          sender_name: senderName,
        },
      },
    });

    if (error) {
      console.error('Error sending push notification:', error);
    } else {
      console.log('[Push] Notification sent successfully to:', recipientId);
    }
  } catch (error) {
    console.error('Failed to send push notification:', error);
  }
}

// Handle notification interactions
export function setupNotificationHandlers(navigation: any) {
  // Handle notifications when app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('Notification received in foreground:', notification);
      
      const data = notification.request.content.data as MessageNotificationData;
      
      if (data.type === 'new_message') {
        // Update unread counts in UI
        // The component will handle this via state updates
      }
    }
  );

  // Handle notification taps
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('Notification tapped:', response);
      
      const data = response.notification.request.content.data as MessageNotificationData;
      
      if (data.type === 'new_message' && data.sender_id) {
        // Navigate to chat with sender
        navigation.navigate('FriendChat', {
          friendId: data.sender_id,
          friendName: data.sender_name || 'Friend',
        });
      }
    }
  );

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

// Update badge count
export async function updateBadgeCount(count: number) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
}

// Register for push notifications
async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {
    // Check if we're on a physical device
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Get existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Get the push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? 
                     Constants.easConfig?.projectId ?? 
                     '@micksolo/VanishVoice'; // Fallback for Expo Go
    
    console.log('App ownership:', Constants.appOwnership);
    console.log('SDK Version:', Constants.expoConfig?.sdkVersion);
    
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('Push token:', token.data);

    // Save token to database
    const { error } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        token: token.data,
        platform: Platform.OS,
      }, {
        onConflict: 'user_id,token'
      });

    if (error) {
      console.error('Error saving push token:', error);
    } else {
      console.log('Push token saved successfully');
    }

    return token.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

// Default export for compatibility
export default {
  registerForPushNotifications,
  setupNotificationListeners: setupNotificationHandlers,
  sendMessageNotification,
  updateBadgeCount,
};