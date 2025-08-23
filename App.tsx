// CRITICAL: Import react-native-get-random-values FIRST for TweetNaCl compatibility
import 'react-native-get-random-values';

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AnonymousAuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { SecurityProvider } from './src/contexts/SecurityContext';
import AppNavigator from './src/navigation/AppNavigator';
import { usePermissions } from './src/hooks/usePermissions';
import pushNotifications from './src/services/pushNotifications';
import { initializeDeviceId } from './src/utils/secureKeyStorage';
import SecurityNotificationManager from './src/components/SecurityNotificationManager';
import monetizationAnalytics from './src/services/monetizationAnalytics';
import './src/utils/devTools'; // Load development tools

function AppContent() {
  usePermissions();
  const { theme } = useTheme();
  
  useEffect(() => {
    // Initialize secure storage
    initializeDeviceId();
    
    // Initialize monetization analytics
    monetizationAnalytics.initialize();

    // Temporary debug: Check native module on app start
    const checkNativeModule = async () => {
      try {
        // Test Expo modules core first
        console.log('[NATIVE MODULE CHECK] Testing Expo modules...');
        const { requireNativeModule } = require('expo-modules-core');
        
        try {
          const ScreenshotPreventModule = requireNativeModule('ScreenshotPrevent');
          console.log('[NATIVE MODULE CHECK] ✅ Expo module loaded successfully');
          console.log('[NATIVE MODULE CHECK] Methods:', Object.keys(ScreenshotPreventModule));
          
          // Test a method
          const isEnabled = await ScreenshotPreventModule.isSecureEnabled();
          console.log('[NATIVE MODULE CHECK] isSecureEnabled result:', isEnabled);
        } catch (expoError) {
          console.error('[NATIVE MODULE CHECK] ❌ Expo module failed:', expoError.message);
        }

        // Fallback to legacy RN modules
        const { NativeModules } = require('react-native');
        console.log('[NATIVE MODULE CHECK] ScreenshotPrevent in NativeModules?', !!NativeModules.ScreenshotPrevent);
        if (NativeModules.ScreenshotPrevent) {
          console.log('[NATIVE MODULE CHECK] Legacy methods:', Object.keys(NativeModules.ScreenshotPrevent));
        }
      } catch (error) {
        console.error('[NATIVE MODULE CHECK] Error:', error);
      }
    };
    checkNativeModule();
  }, []);
  
  return (
    <>
      <AppNavigator />
      <SecurityNotificationManager />
      <StatusBar style={theme.isDark ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <SecurityProvider>
            <AppContent />
          </SecurityProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
