// CRITICAL: Import react-native-get-random-values FIRST for TweetNaCl compatibility
import 'react-native-get-random-values';

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AnonymousAuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
// import { SecurityProvider } from './src/contexts/SecurityContext'; // SHELVED: Screenshot prevention feature
import AppNavigator from './src/navigation/AppNavigator';
import { usePermissions } from './src/hooks/usePermissions';
import pushNotifications from './src/services/pushNotifications';
import { initializeDeviceId } from './src/utils/secureKeyStorage';
// import SecurityNotificationManager from './src/components/SecurityNotificationManager'; // SHELVED: Screenshot prevention feature
// import monetizationAnalytics from './src/services/monetizationAnalytics'; // SHELVED: Screenshot prevention feature
import './src/utils/devTools'; // Load development tools

function AppContent() {
  usePermissions();
  const { theme } = useTheme();
  
  useEffect(() => {
    // Initialize secure storage
    initializeDeviceId();
    
    // SHELVED: Screenshot prevention feature
    // Initialize monetization analytics
    // monetizationAnalytics.initialize();

    // SHELVED: Screenshot prevention feature 
    // Temporary debug: Check native module on app start
    // const checkNativeModule = async () => { ... };
    // checkNativeModule();
  }, []);
  
  return (
    <>
      <AppNavigator />
      {/* SHELVED: Screenshot prevention feature */}
      {/* <SecurityNotificationManager /> */}
      <StatusBar style={theme.isDark ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          {/* SHELVED: Screenshot prevention feature */}
          {/* <SecurityProvider> */}
            <AppContent />
          {/* </SecurityProvider> */}
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
