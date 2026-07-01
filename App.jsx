import React, { useEffect, useRef } from 'react';
import firestoreService from './src/services/FirestoreService';

import {
  registerUserFCMToken,
  setupFCMHandlers,
  consumePendingIncomingCall,
} from './src/services/fcm';

import { View, StyleSheet, useColorScheme, StatusBar } from 'react-native';

// import { GoogleSignin } from '@react-native-google-signin/google-signin';
// import FirebaseAuth from './FirebaseAuth';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from 'react-native-splash-screen';
import usePresence from './src/hooks/usePresence';

const App = () => {
  const navigationRef = useRef(null);
  usePresence();

  // Real-time Firestore call delivery listener
  useEffect(() => {
    let callUnsub = null;

    const authUnsub = firestoreService.onAuthStateChanged(user => {
      // Clean up previous call listener if any
      if (callUnsub) {
        callUnsub();
        callUnsub = null;
      }

      if (user) {
        console.log(
          '[App] Setting up incoming call Firestore listener for uid:',
          user.uid,
        );
        callUnsub = firestoreService.listenIncomingCalls(user.uid, snap => {
          if (!snap) return;

          // Filter on client-side: accept calls created within the last 2 minutes (immune to clock drift)
          const activeCall = snap.docs.find(doc => {
            const data = doc.data();
            const createdAt = data.createdAt;
            if (!createdAt) return false;
            const createdTime = createdAt?.toDate
              ? createdAt.toDate().getTime()
              : new Date(createdAt).getTime();
            const ageMs = Math.abs(Date.now() - createdTime);
            return ageMs < 120000; // 2 minutes
          });

          if (activeCall) {
            const data = activeCall.data();
            console.log(
              '[App] Firestore incoming call detected:',
              activeCall.id,
            );
            if (navigationRef.current) {
              const currentRoute = navigationRef.current.getCurrentRoute()?.name;
              if (
                currentRoute === 'OutgoingCallScreen' ||
                currentRoute === 'IncomingCallScreen' ||
                currentRoute === 'ActiveCallScreen'
              ) {
                console.log(
                  '[App] Ignoring incoming call because user is already in a calling screen:',
                  currentRoute,
                );
                return;
              }

              navigationRef.current.navigate('IncomingCallScreen', {
                callId: activeCall.id,
                remoteUserId: data.callerId,
              });
            }
          }
        });
      }
    });

    return () => {
      authUnsub?.();
      callUnsub?.();
    };
  }, []);

  // useEffect(() => {
  //   // GoogleSignin.configure({
  //   //   webClientId:
  //   //     '282181382577-h8fthkqk8voa87qt10tb4f834i70qpo8.apps.googleusercontent.com',
  //   // });
  // }, []);

  //   const signInWithGoogle = async () => {
  //     try {
  //       await GoogleSignin.hasPlayServices();

  //       const signInResult = await GoogleSignin.signIn();

  //       const idToken = signInResult.data?.idToken || signInResult.idToken;

  //       if (!idToken) {
  //         throw new Error('No ID token found');
  //       }

  //       const googleCredential = auth.GoogleAuthProvider.credential(idToken);

  //       const userCredential = await auth().signInWithCredential(
  //         googleCredential,
  //       );

  //       const user = userCredential.user;

  //       Alert.alert(
  //         'Google Login Success',
  //         `Name: ${user.displayName}
  // Email: ${user.email}
  // UID: ${user.uid}`,
  //       );
  //     } catch (error) {
  //       console.log('Google Sign-In Error:', error);
  //       Alert.alert('Login Failed', error.message || 'Something went wrong');
  //     }
  //   };
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    try {
      if (SplashScreen && typeof SplashScreen.hide === 'function') {
        SplashScreen.hide();
      }
    } catch (e) {
      // SplashScreen native module may be unavailable on some environments.
      console.log('SplashScreen.hide failed', e);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = null;

    const maybeNavigateToIncomingCall = ({ callId, remoteUserId }) => {
      try {
        // IncomingCall screen is registered in AppNavigator.
        // We rely on navigation being available once app is mounted.
        // If navigation isn't ready, just ignore; background handler stores globals.
        if (!navigationRef.current) return;
        navigationRef.current.navigate('IncomingCallScreen', {
          callId,
          remoteUserId,
        });
      } catch {
        // ignore
      }
    };

    const run = async () => {
      try {
        // register/refresh token
        await registerUserFCMToken();

        unsubscribe = await setupFCMHandlers({
          onIncomingCall: params => {
            maybeNavigateToIncomingCall(params);
          },
        });

        // handle pending call if app was opened from a notification
        const pending = consumePendingIncomingCall();
        if (pending) {
          maybeNavigateToIncomingCall(pending);
        }
      } catch (e) {
        console.log('[FCM] setup error', e?.message || String(e));
      }
    };

    run();

    return () => {
      try {
        unsubscribe?.();
      } catch {
        // ignore
      }
    };
  }, []);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? 'black' : 'white',
  };

  return (
    <View style={styles.container}>
      {/* <FirebaseAuth /> */}
      {/* <Button title="Login with Google" onPress={signInWithGoogle} /> */}

      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <NavigationContainer ref={navigationRef}>
        <AppNavigator size="large" />
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
  },
});

export default App;
