import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Toolbar from '../components/Toolbar';
import Ionicons from 'react-native-vector-icons/Ionicons';
import InCallManager from 'react-native-incall-manager';
import firestoreService from '../services/FirestoreService';
import { sharedWebRTCManager } from '../webrtc/WebRTCManager';

export default function ActiveCallScreen({ route, navigation }) {
  const { remoteUserId, callId } = route?.params || {};
  const manager = sharedWebRTCManager;

  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [remoteName, setRemoteName] = useState('Connected User');

  // Listen to call doc to auto-close if call is ended
  useEffect(() => {
    if (!callId) return;

    const unsub = firestoreService.listenCall(callId, snap => {
      if (!snap || !snap.exists) {
        console.log('[ActiveCallScreen] Call document deleted/ended by remote peer');
        navigation.navigate('UserListScreen');
      } else {
        const data = snap.data();
        if (data && (data.status === 'ended' || data.status === 'rejected')) {
          console.log('[ActiveCallScreen] Call status set to ended/rejected by remote peer');
          navigation.navigate('UserListScreen');
        }
      }
    });

    return () => unsub?.();
  }, [callId, navigation]);

  useEffect(() => {
    if (!remoteUserId) return;
    firestoreService.getUser(remoteUserId)
      .then(data => {
        if (data) {
          setRemoteName(data?.email || data?.displayName || remoteUserId);
        } else {
          setRemoteName(remoteUserId);
        }
      })
      .catch(() => {
        setRemoteName(remoteUserId);
      });
  }, [remoteUserId]);
  const [duration, setDuration] = useState(0);

  // Call timer
  useEffect(() => {
    const timerId = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // Format duration as MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Start InCallManager and sync speakerphone
  useEffect(() => {
    try {
      InCallManager.start({ media: 'audio' });
      InCallManager.setForceSpeakerphoneOn(true);
    } catch (e) {
      console.log('[ActiveCallScreen] InCallManager start error', e);
    }

    return () => {
      try {
        InCallManager.stop();
      } catch (e) {
        console.log('[ActiveCallScreen] InCallManager stop error', e);
      }
    };
  }, []);

  // Update speakerphone routing
  const toggleSpeaker = () => {
    setIsSpeakerOn(prev => {
      const next = !prev;
      try {
        InCallManager.setForceSpeakerphoneOn(next);
      } catch (e) {
        console.log('[ActiveCallScreen] InCallManager toggle error', e);
      }
      return next;
    });
  };

  // Toggle local mute
  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      manager.toggleMic?.(next);
      return next;
    });
  };

  // Handle hangup call
  const handleHangup = async () => {
    try {
      await manager.end?.();
    } catch (e) {
      console.log('[ActiveCallScreen] hangup error', e);
    }
    navigation.navigate('UserListScreen');
  };

  // Monitor WebRTC PeerConnection connectionState to auto hangup if dropped/failed
  useEffect(() => {
    const monitorId = setInterval(() => {
      const pc = manager.pc;
      if (!pc) {
        // If there is no peer connection, call has ended
        navigation.navigate('UserListScreen');
        return;
      }

      if (
        pc.connectionState === 'closed' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected'
      ) {
        console.log('[ActiveCallScreen] auto hangup connectionState:', pc.connectionState);
        handleHangup();
      }
    }, 1500);

    return () => clearInterval(monitorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, manager]);

  return (
    <View style={styles.container}>
      <Toolbar />
      
      <View style={styles.header}>
        <Text style={styles.title}>Active Call</Text>
        <Text style={styles.remoteName} numberOfLines={1}>
          {remoteName}
        </Text>
      </View>

      <View style={styles.callContent}>
        {/* Visual indicator */}
        <View style={styles.avatarOutline}>
          <View style={styles.avatarBg}>
            <Ionicons name="person" size={54} color="#e2e8f0" />
          </View>
        </View>
        
        <Text style={styles.statusText}>Call Connected</Text>
        <Text style={styles.timerText}>{formatTime(duration)}</Text>
      </View>

      <View style={styles.controlsWrap}>
        <View style={styles.primaryRow}>
          <TouchableOpacity
            style={[styles.circleBtn, styles.hangupBtn]}
            onPress={handleHangup}
            accessibilityRole="button"
            accessibilityLabel="Hang up"
          >
            <Ionicons name="call" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={[styles.smallBtn, isMuted ? styles.smallBtnActive : null]}
            onPress={toggleMute}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={18}
              color={isMuted ? '#f59e0b' : '#e2e8f0'}
            />
            <Text style={styles.smallBtnText}>
              {isMuted ? 'Muted' : 'Mute'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.smallBtn,
              isSpeakerOn ? styles.smallBtnActive : null,
            ]}
            onPress={toggleSpeaker}
            accessibilityRole="button"
            accessibilityLabel={isSpeakerOn ? 'Earpiece' : 'Speaker'}
          >
            <Ionicons
              name={isSpeakerOn ? 'volume-high' : 'volume-low'}
              size={18}
              color={isSpeakerOn ? '#60a5fa' : '#e2e8f0'}
            />
            <Text style={styles.smallBtnText}>
              {isSpeakerOn ? 'Speaker' : 'Earpiece'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footerHint}>
        <Text style={styles.footerHintText}>Secure WebRTC Audio Session</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 48,
    backgroundColor: '#070b14',
  },
  header: {
    marginBottom: 18,
    alignItems: 'center',
  },
  title: {
    color: 'rgba(226,232,240,0.55)',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  remoteName: {
    marginTop: 6,
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '800',
  },
  callContent: {
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
  statusText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  timerText: {
    color: '#e2e8f0',
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  controlsWrap: {
    justifyContent: 'flex-end',
    paddingBottom: 26,
  },
  primaryRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  circleBtn: {
    width: 74,
    height: 74,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangupBtn: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  smallBtn: {
    flex: 1,
    backgroundColor: '#0b1220',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  smallBtnActive: {
    borderColor: 'rgba(96,165,250,0.65)',
  },
  smallBtnText: {
    marginTop: 8,
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '800',
  },
  footerHint: {
    marginBottom: 8,
    alignItems: 'center',
  },
  footerHintText: {
    color: 'rgba(226,232,240,0.4)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
