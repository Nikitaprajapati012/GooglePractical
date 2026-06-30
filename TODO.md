# Task Progress

## Goal

Investigate and resolve the runtime error:
`WriteStream ... PERMISSION_DENIED (Missing or insufficient permissions)`

## Steps

- [x] Read relevant signaling + WebRTC + FCM code paths that perform Firestore writes.
- [x] Add detailed Firestore write error logging to identify the exact denied path/operation.
  - [x] `src/signaling/FirestoreSignaling.js`
  - [x] `src/webrtc/WebRTCManager.js`
  - [x] `src/services/fcm.js`
- [ ] Reproduce the issue and collect console logs showing:
  - which Firestore operation failed (createCallDoc/setOffer/addIceCandidate/setAnswer/saveUser/registerUserFCMToken)
  - the denied Firestore document path
  - the authenticated uid (if present)
- [ ] Update `firestore.rules` accordingly to grant the required permissions.
