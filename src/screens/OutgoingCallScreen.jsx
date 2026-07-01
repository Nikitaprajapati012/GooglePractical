import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Toolbar from '../components/Toolbar';
import Ionicons from 'react-native-vector-icons/Ionicons';

import firestoreService from '../services/FirestoreService';
import { sharedWebRTCManager } from '../webrtc/WebRTCManager';

export default function OutgoingCallScreen({ route, navigation }) {
  const { remoteUserId } = route?.params || {};
  const localUserId = firestoreService.getCurrentUser()?.uid;

  const manager = sharedWebRTCManager;
  const shouldCleanupOnUnmount = useRef(true);

  const [calleeName, setCalleeName] = useState('...');

  useEffect(() => {
    if (!remoteUserId) return;
    firestoreService.getUser(remoteUserId)
      .then(data => {
        if (data) {
          setCalleeName(data?.email || data?.displayName || remoteUserId);
        } else {
          setCalleeName(remoteUserId);
        }
      })
      .catch(() => {
        setCalleeName(remoteUserId);
      });
  }, [remoteUserId]);

  const [phase, setPhase] = useState('connecting'); // connecting | connected | failed
  const [loading, setLoading] = useState(true);
  const [pcState, setPcState] = useState(null);
  const [iceState, setIceState] = useState(null);
  const [callId, setCallId] = useState(null);
  const [debugCounts, setDebugCounts] = useState({
    remoteIce: 0,
  });
  const [failReason, setFailReason] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;
    const CALL_TIMEOUT_MS = 45000;

    const run = async () => {
      try {
        if (!localUserId) throw new Error('Not authenticated');
        if (!remoteUserId) throw new Error('Missing remoteUserId');

        // Start UI timeout immediately (after we create the call doc it should connect quickly).
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          setFailReason('Timeout waiting for peer connection (answer/ICE)');
          setPhase('failed');
          setLoading(false);
          navigation.navigate('UserListScreen');
          manager.end?.();
        }, CALL_TIMEOUT_MS);

        const { callId: createdCallId } = await manager.initCaller({
          localUserId,
          remoteUserId,
          onState: ({ iceConnectionState, connectionState }) => {
            if (cancelled) return;
            if (iceConnectionState) setIceState(iceConnectionState);
            if (connectionState) setPcState(connectionState);

            // Simple phase mapping.
            if (
              iceConnectionState === 'connected' ||
              connectionState === 'connected'
            ) {
              setPhase('connected');
            } else if (
              iceConnectionState === 'failed' ||
              connectionState === 'failed' ||
              iceConnectionState === 'disconnected'
            ) {
              setPhase('failed');
            }
          },
          onAnswered: () => {
            if (cancelled) return;
            if (timeoutId) clearTimeout(timeoutId);
            setLoading(false);
            setPhase('connected');
            shouldCleanupOnUnmount.current = false;
            navigation.replace('ActiveCallScreen', {
              callId: createdCallId || manager.callId,
              remoteUserId,
            });
          },
        });

        if (cancelled) return;
        if (!createdCallId) {
          if (timeoutId) clearTimeout(timeoutId);
          console.log('[OutgoingCallScreen] initCaller returned null callId (aborted)');
          navigation.navigate('UserListScreen');
          return;
        }
        setCallId(createdCallId || manager.callId || null);
      } catch (e) {
        if (cancelled) return;
        if (timeoutId) clearTimeout(timeoutId);
        console.log('[OutgoingCallScreen] initCaller error', e);
        setFailReason(e?.message || String(e));
        setPhase('failed');
        setLoading(false);
        navigation.navigate('UserListScreen');
      }
    };

    run();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (shouldCleanupOnUnmount.current) {
        manager.cleanup?.();
      }
    };
  }, [localUserId, remoteUserId, navigation, manager]);

  const hangup = () => {
    manager.end?.();
    navigation.navigate('UserListScreen');
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const nextMuted = !prev;
      manager.toggleMic?.(nextMuted);
      return nextMuted;
    });
  };

  const toggleSpeaker = () => {
    // Audio routing may require platform support; UI/UX toggle only for now.
    setIsSpeakerOn(v => !v);
  };

  const statusText =
    phase === 'connected'
      ? 'Connected'
      : phase === 'failed'
      ? 'Call failed'
      : 'Calling…';

  const statusSubText =
    iceState || pcState
      ? `ICE: ${iceState || '—'} • PC: ${pcState || '—'} • Remote ICE docs: ${
          debugCounts.remoteIce
        }
`
      : `Waiting for the peer connection…\nCall: ${callId || '—'}`;

  return (
    <View style={styles.container}>
      <Toolbar />
      <View style={styles.header}>
        {/* <Text style={styles.title}>Outgoing Call</Text> */}
        <Text style={styles.remoteName} numberOfLines={1}>
          {calleeName}
        </Text>
      </View>

      <View style={styles.statusCard}>
        {loading && phase !== 'failed' ? (
          <ActivityIndicator size="small" color="#94a3b8" />
        ) : (
          <Ionicons
            name={phase === 'connected' ? 'checkmark-circle' : 'alert-circle'}
            size={22}
            color={phase === 'connected' ? '#22c55e' : '#ef4444'}
          />
        )}

        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.statusText}>{statusText}</Text>
          <Text style={styles.statusSubText} numberOfLines={2}>
            {statusSubText}
          </Text>
        </View>
      </View>

      <View style={styles.controlsWrap}>
        <View style={styles.primaryRow}>
          <TouchableOpacity
            style={[styles.circleBtn, styles.hangupBtn]}
            onPress={hangup}
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
        <Text style={styles.footerHintText}>
          Keep this screen open until the call connects.
        </Text>
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
  },
  title: {
    color: '#e2e8f0',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  remoteName: {
    marginTop: 10,
    color: 'rgba(226,232,240,0.85)',
    fontSize: 16,
    fontWeight: '700',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1220',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  statusText: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '800',
  },
  statusSubText: {
    marginTop: 4,
    color: 'rgba(226,232,240,0.70)',
    fontSize: 12,
    fontWeight: '600',
  },
  controlsWrap: {
    flex: 1,
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
    color: 'rgba(226,232,240,0.55)',
    fontSize: 12,
    fontWeight: '600',
  },
});
