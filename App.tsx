// CRITICAL: Import react-native-get-random-values FIRST for TweetNaCl compatibility
import 'react-native-get-random-values';

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AnonymousAuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { usePermissions } from './src/hooks/usePermissions';
import pushNotifications from './src/services/pushNotifications';
import { initializeDeviceId } from './src/utils/secureKeyStorage';

function AppContent() {
  usePermissions();
  const { theme } = useTheme();
  
  useEffect(() => {
    // Initialize secure storage
    initializeDeviceId();
  }, []);
  
  return (
    <>
      <AppNavigator />
      <StatusBar style={theme.isDark ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
