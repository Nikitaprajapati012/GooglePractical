import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { mediaDevices, RTCPeerConnection } from 'react-native-webrtc';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Signaling from './src/signaling/FirestoreSignaling';

// NOTE: This is an example. Install react-native-webrtc and follow its setup.
// npm install react-native-webrtc

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function CallScreen({ localUserId, remoteUserId, route }) {
  const resolvedLocalUserId =
    localUserId || route?.params?.localUserId || auth().currentUser?.uid;
  const resolvedRemoteUserId = remoteUserId || route?.params?.remoteUserId;

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callRef = useRef(null);
  const unsubscriptions = useRef([]);
  const [inCall, setInCall] = useState(false);

  useEffect(() => {
    return () => {
      // cleanup
      unsubscriptions.current.forEach(fn => fn && fn());
      if (pcRef.current) pcRef.current.close();
      if (callRef.current) Signaling.hangup(callRef.current);
    };
  }, []);

  const startLocalStream = async () => {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    localStreamRef.current = stream;
    return stream;
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(configuration);
    pc.onicecandidate = event => {
      if (event.candidate && callRef.current) {
        Signaling.addIceCandidate(
          callRef.current,
          event.candidate.toJSON(),
          pc.role || 'caller',
        );
      }
    };
    pc.ontrack = event => {
      // handle remote stream (event.streams[0])
      console.log('Remote stream:', event.streams[0]);
    };
    return pc;
  };

  const initiateCall = async () => {
    if (!resolvedLocalUserId || !resolvedRemoteUserId) {
      Alert.alert('Missing user ids', 'localUserId/remoteUserId are not set.');
      return;
    }
    try {
      const localStream = await startLocalStream();

      const pc = createPeerConnection();
      pcRef.current = pc;
      // add local tracks
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      // create call doc
      const ref = await Signaling.createCallDoc({
        callerId: resolvedLocalUserId,
        calleeId: resolvedRemoteUserId,
      });

      callRef.current = ref;

      // create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await Signaling.setOffer(ref, {
        type: offer.type,
        sdp: offer.sdp,
        callerId: resolvedLocalUserId,
      });

      // listen for answer
      const unsubAns = Signaling.onAnswer(ref, async answer => {
        if (!answer || !answer.sdp) return;
        const remoteDesc = { type: answer.type, sdp: answer.sdp };
        await pc.setRemoteDescription(remoteDesc);
      });
      unsubscriptions.current.push(unsubAns);

      // listen for remote ICE
      const unsubIce = Signaling.listenRemoteIce(
        ref,
        'caller',
        async candidate => {
          try {
            await pc.addIceCandidate(candidate);
          } catch (e) {
            console.log('addIceCandidate error', e);
          }
        },
      );
      unsubscriptions.current.push(unsubIce);

      setInCall(true);
    } catch (e) {
      console.log('initiateCall error', e);
      Alert.alert('Call failed', e.message || String(e));
    }
  };

  const answerToCall = async callId => {
    if (!resolvedLocalUserId || !resolvedRemoteUserId) {
      Alert.alert('Missing user ids', 'localUserId/remoteUserId are not set.');
      return;
    }
    try {
      const ref = firestore().collection('calls').doc(callId);

      const snap = await ref.get();
      const data = snap.data();
      if (!data || !data.offer) throw new Error('No offer found');

      const localStream = await startLocalStream();
      const pc = createPeerConnection();
      pcRef.current = pc;
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      // set remote (offer)
      await pc.setRemoteDescription({
        type: data.offer.type,
        sdp: data.offer.sdp,
      });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await Signaling.setAnswer(ref, {
        type: answer.type,
        sdp: answer.sdp,
        calleeId: resolvedLocalUserId,
      });

      // listen for caller ICE
      const unsubIce = Signaling.listenRemoteIce(
        ref,
        'callee',
        async candidate => {
          try {
            await pc.addIceCandidate(candidate);
          } catch (e) {
            console.log(e);
          }
        },
      );
      unsubscriptions.current.push(unsubIce);

      callRef.current = ref;
      setInCall(true);
    } catch (e) {
      console.log('answerToCall error', e);
      Alert.alert('Answer failed', e.message || String(e));
    }
  };

  const endCall = async () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (callRef.current) {
      await Signaling.hangup(callRef.current);
      callRef.current = null;
    }
    unsubscriptions.current.forEach(fn => fn && fn());
    unsubscriptions.current = [];
    setInCall(false);
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Call demo</Text>
      <Button title="Start Call" onPress={initiateCall} disabled={inCall} />
      <Button title="End Call" onPress={endCall} disabled={!inCall} />
    </View>
  );
}
