import React, { useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';

import firestoreService from '../services/FirestoreService';
import UserCard from '../components/UserCard';
import Toolbar from '../components/Toolbar';

const UserListScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const isNavigating = React.useRef(false);

  const currentUserId = firestoreService.getCurrentUser()?.uid;

  useEffect(() => {
    const unsubscribe = firestoreService.getUsers(snapshot => {
      const list = (snapshot?.docs || [])
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u?.uid && u.uid !== currentUserId);

      setUsers(list);
      setLoading(false);
    });

    return () => unsubscribe?.();
  }, [currentUserId]);

  const handleSignOut = async () => {
    try {
      await firestoreService.signOut();
      navigation.replace('FirebaseAuth');
    } catch (e) {
      console.log('[UserListScreen] signOut error', e);
    }
  };

  return (
    <View style={styles.container}>
      <Toolbar title="User List" onSignOutPress={handleSignOut} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
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
                if (isNavigating.current) return;
                isNavigating.current = true;
                navigation.navigate('OutgoingCallScreen', {
                  remoteUserId: item.uid,
                });
                setTimeout(() => {
                  isNavigating.current = false;
                }, 1000);
              }}
            />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
  },
});

export default UserListScreen;
