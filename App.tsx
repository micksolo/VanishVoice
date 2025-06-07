import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AnonymousAuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { usePermissions } from './src/hooks/usePermissions';
import pushNotifications from './src/services/pushNotifications';
import { initializeDeviceId } from './src/utils/secureKeyStorage';

function AppContent() {
  usePermissions();
  
  useEffect(() => {
    // Initialize secure storage
    initializeDeviceId();
    
    // Set up notification listeners
    const cleanup = pushNotifications.setupNotificationListeners();
    
    return cleanup;
  }, []);
  
  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
