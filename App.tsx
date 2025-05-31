import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AnonymousAuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { usePermissions } from './src/hooks/usePermissions';

function AppContent() {
  usePermissions();
  
  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
