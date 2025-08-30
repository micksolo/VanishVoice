import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';
import { isExpoGo } from './expoGoCompat';

// Configure notification handler (skip in Expo Go as notifications are not available)
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} else {
  console.warn('🚧 Push notifications not available in Expo Go (removed in SDK 53)');
}

export interface MessageNotificationData {
  type: 'new_message' | 'friend_request' | 'screenshot_detected';
  sender_id?: string;
  message_id?: string;
  sender_name?: string;
  screenshot_user_id?: string;
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
      console.error('[Push] Error sending notification:', error);
      console.error('[Push] Error details:', error.message);
    } else {
      console.log('[Push] Notification sent successfully to:', recipientId);
      console.log('[Push] Response:', data);
    }
  } catch (error) {
    console.error('Failed to send push notification:', error);
  }
}

// Send screenshot detection notification to message owner
export async function sendScreenshotNotification(
  messageOwnerId: string,
  screenshotUserId: string,
  messageId: string
) {
  try {
    // Call Edge Function to send push
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        recipient_id: messageOwnerId,
        title: 'Screenshot Detected',
        body: 'Someone took a screenshot of your message',
        data: {
          type: 'screenshot_detected',
          screenshot_user_id: screenshotUserId,
          message_id: messageId,
        },
      },
    });

    if (error) {
      console.error('[Push] Error sending screenshot notification:', error);
      console.error('[Push] Error details:', error.message);
    } else {
      console.log('[Push] Screenshot notification sent successfully to:', messageOwnerId);
      console.log('[Push] Response:', data);
    }
  } catch (error) {
    console.error('Failed to send screenshot notification:', error);
  }
}

// Send friend request notification
export async function sendFriendRequestNotification(
  recipientId: string,
  senderId: string,
  senderName: string
) {
  try {
    // Call Edge Function to send push
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        recipient_id: recipientId,
        title: 'New Friend Request! 👋',
        body: `${senderName} wants to be your friend`,
        data: {
          type: 'friend_request',
          sender_id: senderId,
          sender_name: senderName,
        },
      },
    });

    if (error) {
      console.error('Error sending friend request notification:', error);
    } else {
      console.log('[Push] Friend request notification sent to:', recipientId);
    }
  } catch (error) {
    console.error('Failed to send friend request notification:', error);
  }
}

// Handle notification interactions
export function setupNotificationHandlers(navigation: any) {
  if (isExpoGo) {
    console.warn('🚧 Notification handlers not available in Expo Go');
    return () => {}; // Return empty cleanup function
  }

  // Handle notifications when app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('Notification received in foreground:', notification);
      
      const data = notification.request.content.data as MessageNotificationData;
      
      if (data.type === 'new_message') {
        // Update unread counts in UI
        // The component will handle this via state updates
      } else if (data.type === 'screenshot_detected') {
        // Show screenshot detection alert
        // This will be handled by the component's realtime subscription
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
      } else if (data.type === 'friend_request') {
        // Navigate to friends list to see pending requests
        navigation.navigate('Friends');
      } else if (data.type === 'screenshot_detected') {
        // Navigate to security dashboard or show alert
        // For now, just log it - could navigate to security screen later
        console.log('Screenshot notification tapped for message:', data.message_id);
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
  if (isExpoGo) {
    console.warn('🚧 Badge count not available in Expo Go');
    return;
  }
  
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
}

// Register for push notifications
async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (isExpoGo) {
    console.warn('🚧 Push notification registration not available in Expo Go (removed in SDK 53)');
    return null;
  }
  
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
    console.log('Push token received successfully');

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
  sendFriendRequestNotification,
  sendScreenshotNotification,
  updateBadgeCount,
};

// Export the register function directly for easier access
export { registerForPushNotifications };