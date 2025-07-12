import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AnonymousAuthContext';
import { ActivityIndicator, View } from 'react-native';

import EphemeralInboxScreen from '../screens/EphemeralInboxScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AuthScreen from '../screens/AuthScreen';
import AnonymousLobbyScreen from '../screens/AnonymousLobbyScreen';
import AnonymousChatScreen from '../screens/AnonymousChatScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MessagesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MessagesMain" 
        component={EphemeralInboxScreen}
        options={{ headerShown: false }}
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

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#f8f8f8',
        },
        headerTintColor: '#000',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Messages" 
        component={MessagesStack}
        options={{ title: 'Chats', headerShown: false }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <TabNavigator /> : <AuthScreen />}
    </NavigationContainer>
  );
}