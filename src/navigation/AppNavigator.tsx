import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { Loading } from '../components/ui';

import EphemeralInboxScreen from '../screens/EphemeralInboxScreen';
import FriendsListScreen from '../screens/FriendsListScreen';
import FriendChatScreen from '../screens/FriendChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AuthScreen from '../screens/AuthScreen';
import AnonymousLobbyScreen from '../screens/AnonymousLobbyScreen';
import AnonymousChatScreen from '../screens/AnonymousChatScreen';
import ThemeDemo from '../screens/ThemeDemo';
import EphemeralDemo from '../screens/EphemeralDemo';
import SecuritySettingsScreen from '../screens/SecuritySettingsScreen';
// import SecurityOnboardingScreen from '../screens/SecurityOnboardingScreen'; // SHELVED: Screenshot prevention feature

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function FriendsStack() {
  const theme = useAppTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.subtle,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: theme.typography.headlineMedium,
      }}
    >
      <Stack.Screen 
        name="FriendsList" 
        component={FriendsListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="FriendChat" 
        component={FriendChatScreen}
        options={{ 
          headerShown: false 
        }}
      />
      <Stack.Screen 
        name="AnonymousLobby" 
        component={AnonymousLobbyScreen}
        options={{ 
          title: 'Find Someone',
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen 
        name="AnonymousChat" 
        component={AnonymousChatScreen}
        options={{ 
          headerShown: false 
        }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  const theme = useAppTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.subtle,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: theme.typography.headlineMedium,
      }}
    >
      <Stack.Screen 
        name="ProfileMain" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen 
        name="ThemeDemo" 
        component={ThemeDemo}
        options={{ title: 'Theme Demo' }}
      />
      <Stack.Screen 
        name="EphemeralDemo" 
        component={EphemeralDemo}
        options={{ title: 'Ephemeral Demo' }}
      />
      <Stack.Screen 
        name="SecuritySettings" 
        component={SecuritySettingsScreen}
        options={{ headerShown: false }}
      />
      {/* SHELVED: Screenshot prevention feature
      <Stack.Screen 
        name="SecurityOnboarding" 
        component={SecurityOnboardingScreen}
        options={{ 
          title: 'Security Setup',
          presentation: 'modal'
        }}
      />
      */}
    </Stack.Navigator>
  );
}

function TabNavigator() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Friends') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.text.accent,
        tabBarInactiveTintColor: theme.colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.background.primary,
          borderTopColor: theme.colors.border.subtle,
          paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, theme.spacing.md) : insets.bottom + theme.spacing.sm,
          paddingTop: theme.spacing.sm,
          height: Platform.OS === 'android' 
            ? theme.touchTargets.large + theme.spacing.sm + Math.max(insets.bottom, theme.spacing.md)
            : theme.touchTargets.large + theme.spacing.sm * 2 + insets.bottom,
        },
        tabBarLabelStyle: theme.typography.labelMedium,
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.subtle,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: theme.typography.headlineMedium,
      })}
    >
      <Tab.Screen 
        name="Friends" 
        component={FriendsStack}
        options={{ title: 'Friends', headerShown: false }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStack}
        options={{ title: 'Profile', headerShown: false }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const theme = useAppTheme();

  if (loading) {
    return <Loading fullScreen text="Loading..." />;
  }

  // Create navigation theme based on app theme
  const navigationTheme = theme.isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: theme.colors.button.primary.background,
          background: theme.colors.background.primary,
          card: theme.colors.background.primary,
          text: theme.colors.text.primary,
          border: theme.colors.border.subtle,
          notification: theme.colors.status.error,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: theme.colors.button.primary.background,
          background: theme.colors.background.primary,
          card: theme.colors.background.primary,
          text: theme.colors.text.primary,
          border: theme.colors.border.subtle,
          notification: theme.colors.status.error,
        },
      };

  return (
    <NavigationContainer theme={navigationTheme}>
      {user ? <TabNavigator /> : <AuthScreen />}
    </NavigationContainer>
  );
}