import React, { useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import Signaling from '../signaling/FirestoreSignaling';
import UserCard from '../components/UserCard';

const UserListScreen = ({ navigation, route }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentUserId = route?.params?.userId;

  useEffect(() => {
    const unsubscribe = Signaling.getUsers(snapshot => {
      const list = (snapshot?.docs || [])
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u?.uid && u.uid !== currentUserId);

      setUsers(list);
      setLoading(false);
    });

    return () => unsubscribe?.();
  }, [currentUserId]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.uid}
          renderItem={({ item }) => (
            <UserCard
              user={{
                email: item.email,
                online: item.online,
                uid: item.uid,
              }}
              onPress={() => {
                navigation.navigate('CallScreen', {
                  remoteUserId: item.uid,
                });
              }}
            />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default UserListScreen;
