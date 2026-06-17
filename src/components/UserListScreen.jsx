import React, { useEffect, useState } from 'react';

import { FlatList, View } from 'react-native';

import auth from '@react-native-firebase/auth';

import UserCard from '../../components/UserCard';

import FirestoreService from '../../services/FirestoreService';

export default function UserListScreen() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsubscribe = FirestoreService.getUsers(snapshot => {
      const data = snapshot.docs
        .map(doc => doc.data())
        .filter(item => item.uid !== auth().currentUser.uid);

      setUsers(data);
    });

    return unsubscribe;
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={users}
        keyExtractor={item => item.uid}
        renderItem={({ item }) => (
          <UserCard
            user={item}
            onPress={() => {
              console.log('Selected User', item);
            }}
          />
        )}
      />
    </View>
  );
}
