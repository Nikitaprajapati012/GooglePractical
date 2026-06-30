/* eslint-disable react-native/no-inline-styles */
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
import firestoreService from './src/services/FirestoreService';

const FirebaseAuth = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const usersUnsubscribe = useRef(null);

  const hasShownConnectionAlertRef = useRef(false);

  useEffect(() => {
    const unsubscribe = firestoreService.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      if (currentUser) {
        subscribeToAvailableUsers(currentUser.uid);
        saveUserProfile(currentUser).catch(err =>
          console.log('saveUserProfile error:', err),
        );
        navigation.replace('UserListScreen', { userId: currentUser.uid });
      } else {
        if (usersUnsubscribe.current) {
          usersUnsubscribe.current();
          usersUnsubscribe.current = null;
        }
        setAvailableUsers([]);

        // reset so next login can show the alert again
        hasShownConnectionAlertRef.current = false;
      }
    });

    return () => {
      unsubscribe();
      if (usersUnsubscribe.current) {
        usersUnsubscribe.current();
      }
    };
  }, [navigation]);



  const saveUserProfile = async currentUser => {
    if (!currentUser?.uid) return;
    await firestoreService.saveUserProfile(currentUser);
  };

  const markSipLoggedIn = async user => {
    if (!user?.uid) return;
    await firestoreService.markSipLoggedIn(user);
  };

  const subscribeToAvailableUsers = uid => {
    setLoadingUsers(true);
    if (usersUnsubscribe.current) {
      usersUnsubscribe.current();
    }

    usersUnsubscribe.current = firestoreService.getUsers(
      snapshot => {
        const users = (snapshot?.docs || [])
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(userItem => userItem.uid !== uid);
        // Sort users by email in memory
        users.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
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
      const userCredential = await firestoreService.register(
        email.trim(),
        password,
      );
      await saveUserProfile(userCredential.user);
      await markSipLoggedIn(userCredential.user);
      Alert.alert(
        'Registration successful',
        `Welcome ${userCredential.user.email}`,
      );
    } catch (error) {
      console.log('Firebase registration error:', error);
      const code = error.code || 'unknown';
      Alert.alert(
        'Registration failed',
        `${code}: ${error.message || 'Unable to register'}`,
      );
    }
  };

  const handleLogin = async () => {
    try {
      if (!validateInputs()) return;
      const userCredential = await firestoreService.login(
        email.trim(),
        password,
      );
      await saveUserProfile(userCredential.user);

      // "SIP login at firebase auth time" (presence marker):
      await markSipLoggedIn(userCredential.user);

      // SIP registration using Linphone SDK commented out as requested
      /*
      try {
        const { sipRegister } = require('./src/services/sip/linphone');
        const domain = 'sip.linphone.org';

        try {
          await LinphoneRNModule?.setLogLevel?.({ level: 'debug' });
        } catch {
          // ignore
        }

        await sipRegister({
          domain,
          credentials: [
            {
              username: 'burhanyopmail',
              password: '123456',
            },
          ],
        });
      } catch (e) {
        console.log('sipRegister error:', e);
      }
      */

      navigation.replace('UserListScreen', {
        userId: userCredential.user.uid,
      });
    } catch (error) {
      console.log('Firebase login error:', error);
      const code = error.code || 'unknown';
      let friendly = error.message || 'Unable to login';
      if (code === 'auth/invalid-credential') {
        friendly =
          'Authentication credential is invalid or expired. Try resetting your password.';
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
      Alert.alert(
        'Reset password',
        'Please enter the email to reset password.',
      );
      return;
    }
    try {
      await firestoreService.sendPasswordReset(email.trim());
      Alert.alert(
        'Reset email sent',
        'Check your inbox for password reset instructions.',
      );
    } catch (error) {
      console.log('Password reset error:', error);
      Alert.alert(
        'Reset failed',
        `${error.code || 'error'}: ${error.message || ''}`,
      );
    }
  };

  const handleSignOut = async () => {
    try {
      // Best-effort SIP unregister commented out as requested
      /*
      try {
        const { sipUnregister } = require('./src/services/sip/linphone');
        await sipUnregister();
      } catch (e) {
        console.log('sipUnregister error:', e);
      }
      */

      await firestoreService.signOut();
      Alert.alert('Sign out successful');
    } catch (error) {
      console.log('Firebase sign out error:', error);
      Alert.alert('Sign out failed', error.message || 'Unable to sign out');
    }
  };

  const renderUserItem = ({ item }) => (
    <View style={styles.userItem}>
      <Text style={styles.userEmail}>{item.email}</Text>
      <Text style={styles.userSubtitle}>
        {item.displayName || 'No display name'}
      </Text>
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
          <Text style={styles.loadingText}>
            No other available users found.
          </Text>
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
        // autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        // autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLogin}>
          <Text style={styles.actionText}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleRegister}
        >
          <Text style={styles.secondaryText}>Register</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.modeButton, { marginTop: 6 }]}
        onPress={handleSendPasswordReset}
      >
        <Text style={styles.modeText}>Forgot password? Send reset email</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.modeButton}
        onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        <Text style={styles.modeText}>
          {mode === 'login' ? 'Switch to register' : 'Switch to login'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: '100%',
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#070b14',
  },
  title: {
    color: '#e2e8f0',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    color: '#e2e8f0',
    backgroundColor: '#0b1220',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  secondaryText: {
    color: '#e2e8f0',
    fontWeight: '800',
    fontSize: 15,
  },
  modeButton: {
    marginTop: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeText: {
    color: '#60a5fa',
    fontWeight: '700',
    fontSize: 14,
  },
  label: {
    fontSize: 14,
    color: 'rgba(226,232,240,0.6)',
    marginTop: 10,
  },
  value: {
    fontSize: 16,
    color: '#e2e8f0',
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#e2e8f0',
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 12,
  },
  loadingText: {
    color: 'rgba(226,232,240,0.5)',
    marginBottom: 12,
  },
  userList: {
    paddingBottom: 10,
  },
  userItem: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    marginBottom: 12,
  },
  userEmail: {
    fontSize: 15,
    color: '#e2e8f0',
    fontWeight: '700',
  },
  userSubtitle: {
    fontSize: 12,
    color: 'rgba(226,232,240,0.6)',
    marginTop: 4,
  },
});

export default FirebaseAuth;
