import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '../screens/SplashScreen';
import UserListScreen from '../screens/UserListScreen';
import FirebaseAuth from '../../FirebaseAuth';
import CallScreen from '../../CallScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShkown: false }}>
      <Stack.Screen name="SplashScreen" component={SplashScreen} />

      <Stack.Screen name="FirebaseAuth" component={FirebaseAuth} />

      <Stack.Screen name="UserListScreen" component={UserListScreen} />

      <Stack.Screen name="CallScreen" component={CallScreen} />
    </Stack.Navigator>
  );
}
