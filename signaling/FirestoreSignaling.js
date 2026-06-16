import firestore from '@react-native-firebase/firestore';

/**
 * Firestore-based signaling helpers.
 * Data model:
 * collection: calls
 *   doc: <callId>
 *     offer: { type, sdp, callerId }
 *     answer: { type, sdp, calleeId }
 *   subcollections:
 *     callerCandidates
 *     calleeCandidates
 */

export async function createCallDoc({ callerId, calleeId }) {
  const callsRef = firestore().collection('calls');
  const callRef = callsRef.doc();
  await callRef.set({
    callerId,
    calleeId,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  return callRef;
}

export async function setOffer(callRef, offer) {
  await callRef.set({ offer }, { merge: true });
}

export function onAnswer(callRef, cb) {
  return callRef.onSnapshot(snapshot => {
    const data = snapshot.data();
    if (data && data.answer) cb(data.answer);
  });
}

export async function setAnswer(callRef, answer) {
  await callRef.set({ answer }, { merge: true });
}

export async function addIceCandidate(callRef, candidate, role = 'caller') {
  const col = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
  await callRef
    .collection(col)
    .add({ candidate, createdAt: firestore.FieldValue.serverTimestamp() });
}

export function listenRemoteIce(callRef, role = 'caller', onAdd) {
  // role param indicates this client role; we listen to the *other* role's candidates
  const remoteCol = role === 'caller' ? 'calleeCandidates' : 'callerCandidates';
  return callRef.collection(remoteCol).onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const data = change.doc.data();
        if (data && data.candidate) onAdd(data.candidate);
      }
    });
  });
}

export async function hangup(callRef) {
  if (!callRef) return;
  // try to delete subcollections then doc (best effort)
  try {
    const subs = ['callerCandidates', 'calleeCandidates'];
    for (const name of subs) {
      const snap = await callRef.collection(name).get();
      const batch = firestore().batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await callRef.delete();
  } catch (e) {
    console.log('hangup cleanup error', e);
  }
}

export function onCallReady(callRef, cb) {
  return callRef.onSnapshot(snap => {
    const data = snap.data();
    cb(data || {});
  });
}

export default {
  createCallDoc,
  setOffer,
  onAnswer,
  setAnswer,
  addIceCandidate,
  listenRemoteIce,
  hangup,
  onCallReady,
};
