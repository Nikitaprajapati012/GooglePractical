import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  FlatList,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const FirebaseAuth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const usersUnsubscribe = useRef(null);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(currentUser => {
      setUser(currentUser);
      if (currentUser) {
        subscribeToAvailableUsers(currentUser.uid);
        saveUserProfile(currentUser).catch(err => console.log('saveUserProfile error:', err));
      } else {
        if (usersUnsubscribe.current) {
          usersUnsubscribe.current();
          usersUnsubscribe.current = null;
        }
        setAvailableUsers([]);
      }
    });

    return () => {
      unsubscribe();
      if (usersUnsubscribe.current) {
        usersUnsubscribe.current();
      }
    };
  }, []);

  const saveUserProfile = async currentUser => {
    if (!currentUser?.uid) return;
    await firestore()
      .collection('users')
      .doc(currentUser.uid)
      .set(
        {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || '',
          lastSeen: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  };

  const subscribeToAvailableUsers = uid => {
    setLoadingUsers(true);
    if (usersUnsubscribe.current) {
      usersUnsubscribe.current();
    }

    usersUnsubscribe.current = firestore()
      .collection('users')
      .orderBy('email')
      .onSnapshot(
        snapshot => {
          const users = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(userItem => userItem.uid !== uid);
          setAvailableUsers(users);
          setLoadingUsers(false);
        },
        error => {
          console.log('Available users snapshot error:', error);
          setLoadingUsers(false);
        },
      );
  };

  const validateInputs = () => {
    if (!email || email.trim().length === 0) {
      Alert.alert('Validation', 'Please enter an email address.');
      return false;
    }
    if (!password || password.length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    try {
      if (!validateInputs()) return;
      const userCredential = await auth().createUserWithEmailAndPassword(email.trim(), password);
      await saveUserProfile(userCredential.user);
      Alert.alert('Registration successful', `Welcome ${userCredential.user.email}`);
    } catch (error) {
      console.log('Firebase registration error:', error);
      const code = error.code || 'unknown';
      Alert.alert('Registration failed', `${code}: ${error.message || 'Unable to register'}`);
    }
  };

  const handleLogin = async () => {
    try {
      if (!validateInputs()) return;
      const userCredential = await auth().signInWithEmailAndPassword(email.trim(), password);
      await saveUserProfile(userCredential.user);
      Alert.alert('Login successful', `Welcome back ${userCredential.user.email}`);
    } catch (error) {
      console.log('Firebase login error:', error);
      const code = error.code || 'unknown';
      let friendly = error.message || 'Unable to login';
      if (code === 'auth/invalid-credential') {
        friendly = 'Authentication credential is invalid or expired. Try resetting your password.';
      } else if (code === 'auth/user-not-found') {
        friendly = 'No user found with this email. Please register first.';
      } else if (code === 'auth/wrong-password') {
        friendly = 'The password is incorrect. Try resetting your password.';
      }
      Alert.alert('Login failed', `${code}: ${friendly}`);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!email || email.trim().length === 0) {
      Alert.alert('Reset password', 'Please enter the email to reset password.');
      return;
    }
    try {
      await auth().sendPasswordResetEmail(email.trim());
      Alert.alert('Reset email sent', 'Check your inbox for password reset instructions.');
    } catch (error) {
      console.log('Password reset error:', error);
      Alert.alert('Reset failed', `${error.code || 'error'}: ${error.message || ''}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth().signOut();
      Alert.alert('Sign out successful');
    } catch (error) {
      console.log('Firebase sign out error:', error);
      Alert.alert('Sign out failed', error.message || 'Unable to sign out');
    }
  };

  const renderUserItem = ({ item }) => (
    <View style={styles.userItem}>
      <Text style={styles.userEmail}>{item.email}</Text>
      <Text style={styles.userSubtitle}>{item.displayName || 'No display name'}</Text>
    </View>
  );

  if (user) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Firebase Auth</Text>
        <Text style={styles.label}>Signed in as:</Text>
        <Text style={styles.value}>{user.email}</Text>
        <Text style={styles.label}>UID:</Text>
        <Text style={styles.value}>{user.uid}</Text>
        <Text style={styles.sectionTitle}>Available users</Text>
        {loadingUsers ? (
          <Text style={styles.loadingText}>Loading users...</Text>
        ) : availableUsers.length > 0 ? (
          <FlatList
            data={availableUsers}
            keyExtractor={item => item.id}
            renderItem={renderUserItem}
            contentContainerStyle={styles.userList}
          />
        ) : (
          <Text style={styles.loadingText}>No other available users found.</Text>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
          <Text style={styles.actionText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Firebase Email Auth</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLogin}>
          <Text style={styles.actionText}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleRegister}>
          <Text style={styles.secondaryText}>Register</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.modeButton, { marginTop: 6 }]} onPress={handleSendPasswordReset}>
        <Text style={styles.modeText}>Forgot password? Send reset email</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.modeButton} onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
        <Text style={styles.modeText}>{mode === 'login' ? 'Switch to register' : 'Switch to login'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 24,
    padding: 18,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2e78b7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  secondaryText: {
    color: '#333',
    fontWeight: '700',
  },
  modeButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeText: {
    color: '#2e78b7',
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    color: '#444',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 10,
  },
  loadingText: {
    color: '#666',
    marginBottom: 12,
  },
  userList: {
    paddingBottom: 10,
  },
  userItem: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f5f8ff',
    marginBottom: 10,
  },
  userEmail: {
    fontSize: 15,
    fontWeight: '600',
  },
  userSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
});

export default FirebaseAuth;
