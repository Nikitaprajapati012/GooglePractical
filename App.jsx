import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const App = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId:
        '282181382577-h8fthkqk8voa87qt10tb4f834i70qpo8.apps.googleusercontent.com',
    });

    const subscriber = auth().onAuthStateChanged(user => {
      setCurrentUser(user);
    });

    return subscriber;
  }, []);

  const showError = error => {
    console.log('Firebase Auth Error:', error);
    Alert.alert('Authentication Error', error.message || 'Unexpected error');
  };

  const signUpWithEmail = async () => {
    setIsLoading(true);
    try {
      await auth().createUserWithEmailAndPassword(email.trim(), password);
      Alert.alert('Registration complete', 'Your account has been created.');
      setEmail('');
      setPassword('');
      setAuthMode('login');
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async () => {
    setIsLoading(true);
    try {
      await auth().signInWithEmailAndPassword(email.trim(), password);
      Alert.alert('Login successful', 'You are now signed in.');
      setEmail('');
      setPassword('');
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken || signInResult.idToken;

      if (!idToken) {
        throw new Error('No ID token found for Google sign-in');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);
      Alert.alert('Login successful', 'Signed in with Google.');
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await auth().signOut();
      Alert.alert('Signed out', 'You have been signed out.');
    } catch (error) {
      showError(error);
    }
  };

  if (currentUser) {
    return (
      <View style={styles.signedInContainer}>
        <Text style={styles.title}>Welcome back!</Text>
        <Text style={styles.label}>Name: {currentUser.displayName || 'Not set'}</Text>
        <Text style={styles.label}>Email: {currentUser.email}</Text>
        <Text style={styles.label}>UID: {currentUser.uid}</Text>
        <View style={styles.buttonSpacing}>
          <Button title="Sign out" onPress={signOut} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Firebase Authentication</Text>
        <View style={styles.modeSwitcher}>
          <Button
            title="Login"
            onPress={() => setAuthMode('login')}
            color={authMode === 'login' ? '#007AFF' : '#999'}
          />
          <Button
            title="Register"
            onPress={() => setAuthMode('register')}
            color={authMode === 'register' ? '#007AFF' : '#999'}
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!isLoading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!isLoading}
        />

        <View style={styles.buttonSpacing}>
          <Button
            title={authMode === 'login' ? 'Sign in' : 'Create account'}
            onPress={authMode === 'login' ? signInWithEmail : signUpWithEmail}
            disabled={isLoading || !email || !password}
          />
        </View>

        <View style={styles.divider} />

        <Text style={styles.subtitle}>Or sign in with Google</Text>
        <View style={styles.buttonSpacing}>
          <Button title="Login with Google" onPress={signInWithGoogle} disabled={isLoading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  signedInContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f7fb',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#444',
    marginBottom: 12,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  buttonSpacing: {
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#dde3ea',
    marginVertical: 20,
  },
  modeSwitcher: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
});

export default App;
