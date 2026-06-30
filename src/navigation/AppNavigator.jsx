import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import UserListScreen from '../screens/UserListScreen';

import FirebaseAuth from '../../FirebaseAuth';

import SplashScreen from '../screens/SplashScreen';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';
import OutgoingCallScreen from '../screens/OutgoingCallScreen';
import ActiveCallScreen from '../screens/ActiveCallScreen';
import CallHistoryScreen from '../screens/CallHistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SplashScreen" component={SplashScreen} />

      {/* Backward-compatible: current entry uses FirebaseAuth route. */}
      <Stack.Screen name="FirebaseAuth" component={FirebaseAuth} />
      <Stack.Screen name="LoginScreen" component={LoginScreen} />

      <Stack.Screen name="HomeScreen" component={HomeScreen} />
      <Stack.Screen name="UserListScreen" component={UserListScreen} />

      {/* Incoming/outgoing UI scaffolding (Phase 1). */}
      <Stack.Screen name="IncomingCallScreen" component={IncomingCallScreen} />
      <Stack.Screen name="OutgoingCallScreen" component={OutgoingCallScreen} />

      <Stack.Screen name="ActiveCallScreen" component={ActiveCallScreen} />

      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
