import { mediaDevices, RTCPeerConnection } from 'react-native-webrtc';
import { Platform } from 'react-native';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import firestoreService from '../services/FirestoreService';

const LOG_PREFIX = '[WEBRTC][manager]';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

// Video disabled as requested.
const AUDIO_ONLY_CALL = true;

function getRemoteRole(localRole) {
  return localRole === 'caller' ? 'callee' : 'caller';
}

function safeErr(e) {
  if (!e) return 'unknown error';
  if (typeof e === 'string') return e;
  try {
    return e?.message ? `${e.message}` : String(e);
  } catch {
    return String(e);
  }
}

export default class WebRTCManager {
  constructor() {
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;

    this.callId = null;

    this.pendingIce = [];
    this.remoteDescriptionSet = false;

    this.unsubs = [];

    this._localRole = 'caller';
    this._remoteRole = getRemoteRole(this._localRole);
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  isReady() {
    return !!this.pc && !!this.callId;
  }

  cleanup() {
    try {
      this.unsubs.forEach(fn => fn && fn());
    } catch (e) {
      // ignore
    }
    this.unsubs = [];

    try {
      if (this.pc) this.pc.close();
    } catch (e) {
      // ignore
    }
    this.pc = null;
    this.remoteStream = null;
    this.pendingIce = [];
    this.remoteDescriptionSet = false;

    const id = this.callId;
    this.callId = null;

    return id ? firestoreService.hangup(id).catch(() => null) : Promise.resolve();
  }

  async _ensureMicrophonePermission() {
    try {
      const permission =
        Platform.OS === 'android'
          ? PERMISSIONS.ANDROID.RECORD_AUDIO
          : PERMISSIONS.IOS.MICROPHONE;
      const status = await request(permission);
      if (status === RESULTS.GRANTED) {
        return true;
      }
      throw new Error(`Microphone permission status: ${status}`);
    } catch (e) {
      console.log(`${LOG_PREFIX} microphone permission error`, e);
      throw new Error('Microphone permission is required to make calls.');
    }
  }

  _logStepError(step, err, extra = {}) {
    console.log(
      `${LOG_PREFIX} ${step} error`,
      JSON.stringify({
        message: safeErr(err),
        ...extra,
      }),
    );
  }

  async _startLocalStream() {
    await this._ensureMicrophonePermission();

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: AUDIO_ONLY_CALL ? false : true,
    });

    this.localStream = stream;
    return stream;
  }

  _createPeerConnection({ onRemoteStream, onState } = {}) {
    const pc = new RTCPeerConnection(configuration);

    pc.oniceconnectionstatechange = () => {
      console.log(
        `${LOG_PREFIX} iceConnectionState (${this._localRole}) ->`,
        pc.iceConnectionState,
      );
      onState?.({ iceConnectionState: pc.iceConnectionState });
    };

    pc.onconnectionstatechange = () => {
      console.log(
        `${LOG_PREFIX} connectionState (${this._localRole}) ->`,
        pc.connectionState,
      );
      onState?.({ connectionState: pc.connectionState });
    };

    pc.ontrack = event => {
      const stream = event.streams?.[0];
      console.log(
        `${LOG_PREFIX} ontrack (${this._localRole})`,
        JSON.stringify({
          trackKind: event.track?.kind,
          streams: event.streams?.length,
        }),
      );
      if (!stream) return;
      this.remoteStream = stream;
      onRemoteStream?.(stream);
    };

    pc.onicecandidate = async event => {
      if (!event.candidate || !this.callId) return;
      try {
        const candidateJson =
          typeof event.candidate.toJSON === 'function'
            ? event.candidate.toJSON()
            : event.candidate;

        await firestoreService.addIceCandidate(this.callId, candidateJson, this._localRole);
      } catch (e) {
        console.log(
          `${LOG_PREFIX} addIceCandidate error (${this._localRole})`,
          safeErr(e),
        );
      }
    };

    this.pc = pc;
    return pc;
  }

  _attachLocalTracks(stream) {
    if (!this.pc) throw new Error('PC not created');
    stream.getTracks().forEach(track => {
      this.pc.addTrack(track, stream);
    });
  }

  _listenForRemoteICE() {
    if (!this.callId) throw new Error('callId not set');

    // listenRemoteIce expects the *local role* so it can subscribe to
    // the *remote* candidates collection.
    const unsub = firestoreService.listenRemoteIce(
      this.callId,
      this._localRole,
      async candidate => {
        try {
          console.log(
            `${LOG_PREFIX} remote ICE received (${this._localRole})`,
            JSON.stringify({
              sdpMid: candidate?.sdpMid,
              sdpMLineIndex: candidate?.sdpMLineIndex,
              candidateType: candidate?.candidate?.split(' ')[2] || null,
              queued: !this.remoteDescriptionSet,
            }),
          );

          // Queue ICE until remote description is set.
          if (!this.remoteDescriptionSet) {
            this.pendingIce.push(candidate);
            return;
          }

          await this.pc.addIceCandidate(candidate);
          console.log(
            `${LOG_PREFIX} pc.addIceCandidate OK (${this._localRole})`,
          );
        } catch (e) {
          console.log(
            `${LOG_PREFIX} remote addIceCandidate error (${this._localRole})`,
            safeErr(e),
          );
        }
      },
    );

    this.unsubs.push(unsub);
  }

  async _flushPendingIce() {
    if (!this.pc) return;
    const toFlush = this.pendingIce;
    this.pendingIce = [];

    console.log(
      `${LOG_PREFIX} flushing pending ICE (${this._localRole})`,
      JSON.stringify({ count: toFlush.length }),
    );

    for (const c of toFlush) {
      try {
        await this.pc.addIceCandidate(c);
        console.log(
          `${LOG_PREFIX} flush pc.addIceCandidate OK (${this._localRole})`,
        );
      } catch (e) {
        console.log(
          `${LOG_PREFIX} flush addIceCandidate error (${this._localRole})`,
          safeErr(e),
        );
      }
    }
  }

  async initCaller({
    localUserId,
    remoteUserId,
    onRemoteStream,
    onState,
    onAnswered,
  } = {}) {
    if (!localUserId || !remoteUserId) {
      throw new Error('initCaller: localUserId/remoteUserId are required');
    }

    this._localRole = 'caller';
    this._remoteRole = getRemoteRole(this._localRole);

    await this.cleanup();

    try {
      await this._startLocalStream();
      if (this._localRole !== 'caller') return { callId: null }; // aborted

      this._createPeerConnection({ onRemoteStream, onState });
      this._attachLocalTracks(this.localStream);

      const callId = await firestoreService.createCallDoc({
        callerId: localUserId,
        calleeId: remoteUserId,
      });
      if (!this.pc) return { callId: null }; // aborted

      this.callId = callId;

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      if (!this.pc || !this.callId) return { callId: null }; // aborted

      await firestoreService.setOffer(callId, {
        type: offer.type,
        sdp: offer.sdp,
        callerId: localUserId,
      });
      if (!this.pc || !this.callId) return { callId: null }; // aborted

      // Answer listener
      const unsubAns = firestoreService.onAnswer(callId, async answer => {
        if (!answer?.sdp) return;
        try {
          if (!this.pc) return;
          await this.pc.setRemoteDescription({
            type: answer.type,
            sdp: answer.sdp,
          });
          this.remoteDescriptionSet = true;
          await this._flushPendingIce();
          onAnswered?.({ answer });
        } catch (e) {
          this._logStepError('initCaller.onAnswer:setRemoteDescription', e, {
            callId,
          });
        }
      });
      this.unsubs.push(unsubAns);

      this._listenForRemoteICE();

      return { callId };
    } catch (e) {
      this._logStepError('initCaller', e, {
        localUserId,
        remoteUserId,
      });
      throw e;
    }
  }

  async initCallee({
    localUserId,
    callId,
    onRemoteStream,
    onState,
    onAnswered,
  } = {}) {
    if (!localUserId) throw new Error('initCallee: localUserId is required');

    this._localRole = 'callee';
    this._remoteRole = getRemoteRole(this._localRole);

    await this.cleanup();

    try {
      await this._startLocalStream();
      if (this._localRole !== 'callee') return { callId: null }; // aborted

      this._createPeerConnection({ onRemoteStream, onState });
      this._attachLocalTracks(this.localStream);

      // Resolve call doc
      let resolvedCallId = null;
      if (callId) {
        resolvedCallId = callId;
      } else {
        // Find latest call where calleeId == localUserId
        const latestDoc = await firestoreService.getLatestCallForCallee(localUserId);
        if (!this.pc) return { callId: null }; // aborted
        if (!latestDoc) throw new Error('No call doc found for this calleeId');
        resolvedCallId = latestDoc.id;
      }

      this.callId = resolvedCallId;

      const data = await firestoreService.getCall(resolvedCallId);
      if (!this.pc || !this.callId) return { callId: null }; // aborted
      if (!data?.offer) throw new Error('No offer found');

      await this.pc.setRemoteDescription({
        type: data.offer.type,
        sdp: data.offer.sdp,
      });
      if (!this.pc || !this.callId) return { callId: null }; // aborted

      this.remoteDescriptionSet = true;
      await this._flushPendingIce();

      // listen caller ICE
      this._listenForRemoteICE();

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      if (!this.pc || !this.callId) return { callId: null }; // aborted

      await firestoreService.setAnswer(resolvedCallId, {
        type: answer.type,
        sdp: answer.sdp,
        calleeId: localUserId,
      });
      if (!this.pc || !this.callId) return { callId: null }; // aborted

      onAnswered?.({ answer });

      return { callId: resolvedCallId };
    } catch (e) {
      this._logStepError('initCallee', e, {
        localUserId,
        callId,
      });
      throw e;
    }
  }

  async end() {
    await this.cleanup();
  }

  async toggleMic(muted) {
    const stream = this.localStream;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks?.().forEach(t => {
      t.enabled = next;
    });
  }
}

export const sharedWebRTCManager = new WebRTCManager();
