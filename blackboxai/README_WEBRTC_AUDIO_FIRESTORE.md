# WebRTC Audio Call with Firebase (Firestore) Signaling

This project uses a Firestore document to exchange SDP offer/answer and ICE candidates.

## Call flow

1. **Caller** creates `calls/<callId>` and writes:
   - `callerId`, `calleeId`
   - `offer { type, sdp }`
   - ICE candidates into `callerCandidates/*`
2. **Callee** listens for `offer`, sets it as `remoteDescription`, creates:
   - `answer { type, sdp }` back to the same `calls/<callId>` doc
   - ICE candidates into `calleeCandidates/*`
3. Both sides listen to the _other side’s_ ICE subcollection.

## Debug checklist (peer connection success)

- Ensure both devices are authenticated (Firebase Auth) and Firestore security rules allow:
  - read/write `calls/*`
  - read/write `calls/*/callerCandidates/*`
  - read/write `calls/*/calleeCandidates/*`
- Verify on Firestore console while calling:
  - `calls/<callId>` appears quickly when you press Start Call
  - Caller doc gets `offer`
  - Callee sets `answer`
  - ICE subcollections get candidates from both sides
- In logs (CallScreen), look for:
  - `setLocalDescription(offer/answer) success`
  - `setRemoteDescription success`
  - ICE states: `checking` → `connected` → `completed`
  - buffered ICE flush count (should be >0 only if ICE arrives early)

## Runtime permissions

- Android requires `RECORD_AUDIO` for audio calls.
- Camera permission is not required if `video: false` (audio-only mode).
- iOS requires `NSMicrophoneUsageDescription`.
