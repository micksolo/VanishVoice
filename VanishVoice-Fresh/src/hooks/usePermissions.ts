import { useEffect } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export const usePermissions = () => {
  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      // Request audio permissions on app start
      const { status } = await Audio.requestPermissionsAsync();
      
      if (status === 'granted') {
        // Set up audio mode for iOS
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  return { requestPermissions };
};