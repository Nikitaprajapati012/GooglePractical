import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Toolbar from '../components/Toolbar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestoreService from '../services/FirestoreService';
import { sharedWebRTCManager } from '../webrtc/WebRTCManager';

export default function IncomingCallScreen({ route, navigation }) {
  const { remoteUserId, callId } = route?.params || {};
  const localUserId = firestoreService.getCurrentUser()?.uid;

  const manager = sharedWebRTCManager;
  const shouldCleanupOnUnmount = useRef(true);

  const [status, setStatus] = useState('ringing'); // ringing | connecting
  const [callerName, setCallerName] = useState('Incoming Caller');

  useEffect(() => {
    if (!remoteUserId) return;
    firestoreService.getUser(remoteUserId)
      .then(data => {
        if (data) {
          setCallerName(data?.email || data?.displayName || remoteUserId);
        } else {
          setCallerName(remoteUserId);
        }
      })
      .catch(() => {
        setCallerName(remoteUserId);
      });
  }, [remoteUserId]);

  // Listen to call doc to auto close if caller hangs up/cancels
  useEffect(() => {
    if (!callId) return;

    const unsub = firestoreService.listenCall(callId, snap => {
      if (!snap || !snap.exists) {
        console.log('[IncomingCallScreen] Call document deleted by caller');
        navigation.navigate('UserListScreen');
      } else {
        const data = snap.data();
        if (
          data &&
          (data.status === 'ended' || data.status === 'rejected')
        ) {
          navigation.navigate('UserListScreen');
        }
      }
    });

    return () => unsub?.();
  }, [callId, navigation]);

  // Cleanup WebRTC connection on unmount if not connected/transitioned
  useEffect(() => {
    return () => {
      if (shouldCleanupOnUnmount.current) {
        manager.cleanup?.();
      }
    };
  }, [manager]);

  const handleAccept = async () => {
    setStatus('connecting');
    try {
      if (!localUserId) throw new Error('Not authenticated');

      const res = await manager.initCallee({
        localUserId,
        callId,
        onAnswered: () => {
          shouldCleanupOnUnmount.current = false;
          navigation.replace('ActiveCallScreen', {
            callId: manager.callId,
            remoteUserId: remoteUserId || null,
          });
        },
      });
      if (!res || !res.callId) {
        console.log('[IncomingCallScreen] initCallee returned null callId (aborted)');
        navigation.navigate('UserListScreen');
        return;
      }
    } catch (e) {
      console.log('[IncomingCallScreen] initCallee error', e);
      Alert.alert('Call failed', e?.message || String(e));
      setStatus('ringing');
    }
  };

  const handleDecline = async () => {
    try {
      await manager.end?.();
    } catch (e) {
      console.log('[IncomingCallScreen] decline error', e);
    }
    navigation.navigate('UserListScreen');
  };

  return (
    <View style={styles.container}>
      <Toolbar />

      <View style={styles.content}>
        <View style={styles.avatarOutline}>
          <View style={styles.avatarBg}>
            <Ionicons name="person" size={54} color="#e2e8f0" />
          </View>
        </View>

        <Text style={styles.remoteName}>
          {callerName}
        </Text>
        <Text style={styles.statusText}>
          {status === 'connecting'
            ? 'Connecting peer connection…'
            : 'Incoming Call'}
        </Text>

        {status === 'connecting' && (
          <ActivityIndicator
            size="small"
            color="#60a5fa"
            style={styles.loader}
          />
        )}
      </View>

      <View style={styles.controls}>
        {status === 'ringing' ? (
          <View style={styles.actionsRow}>
            {/* Decline Button */}
            <TouchableOpacity
              style={[styles.circleBtn, styles.declineBtn]}
              onPress={handleDecline}
              accessibilityRole="button"
              accessibilityLabel="Decline Call"
            >
              <Ionicons
                name="call"
                size={26}
                color="#fff"
                style={styles.hangupIcon}
              />
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              style={[styles.circleBtn, styles.acceptBtn]}
              onPress={handleAccept}
              accessibilityRole="button"
              accessibilityLabel="Accept Call"
            >
              <Ionicons name="call" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            {/* Cancel Connecting Button */}
            <TouchableOpacity
              style={[styles.circleBtn, styles.declineBtn]}
              onPress={handleDecline}
              accessibilityRole="button"
              accessibilityLabel="Cancel Call"
            >
              <Ionicons
                name="call"
                size={26}
                color="#fff"
                style={styles.hangupIcon}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
    paddingHorizontal: 18,
    paddingTop: 48,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  avatarOutline: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(96,165,250,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarBg: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#0b1220',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
  },
  remoteName: {
    color: '#e2e8f0',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  statusText: {
    color: 'rgba(226,232,240,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  loader: {
    marginTop: 16,
  },
  controls: {
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
  },
  circleBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  acceptBtn: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  hangupIcon: {
    transform: [{ rotate: '135deg' }],
  },
});
