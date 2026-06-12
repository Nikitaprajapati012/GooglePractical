import React, { useEffect } from 'react';
import { View, Button, Alert, StyleSheet } from 'react-native';

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';

const App = () => {
  useEffect(() => {
    GoogleSignin.configure({
      webClientId:
        '282181382577-h8fthkqk8voa87qt10tb4f834i70qpo8.apps.googleusercontent.com',
    });
  }, []);

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();

      const signInResult = await GoogleSignin.signIn();

      const idToken = signInResult.data?.idToken || signInResult.idToken;

      if (!idToken) {
        throw new Error('No ID token found');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      const userCredential = await auth().signInWithCredential(
        googleCredential,
      );

      const user = userCredential.user;

      Alert.alert(
        'Google Login Success',
        `Name: ${user.displayName}
Email: ${user.email}
UID: ${user.uid}`,
      );
    } catch (error) {
      console.log('Google Sign-In Error:', error);

      Alert.alert('Login Failed', error.message || 'Something went wrong');
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Login with Google" onPress={signInWithGoogle} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});

export default App;
