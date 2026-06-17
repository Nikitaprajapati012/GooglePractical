import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function UserCard({ user, onPress }) {
  return (
    <TouchableOpacity onPress={onPress}>
      <View
        style={{
          padding: 15,
          borderBottomWidth: 1,
        }}
      >
        <Text>{user.email}</Text>

        <Text>{user.online ? '🟢 Online' : '⚪ Offline'}</Text>
      </View>
    </TouchableOpacity>
  );
}
