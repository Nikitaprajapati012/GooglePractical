import auth from '@react-native-firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDoc,
} from '@react-native-firebase/firestore';

class FirestoreService {
  // --- AUTHENTICATION METHODS ---

  async login(email, password) {
    return auth().signInWithEmailAndPassword(email.trim(), password);
  }

  async register(email, password) {
    return auth().createUserWithEmailAndPassword(email.trim(), password);
  }

  async signOut() {
    const user = auth().currentUser;
    if (user?.uid) {
      const db = getFirestore();
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          sip: {
            loggedIn: false,
            registered: false,
            registrationError: null,
          },
          online: false,
          lastSeen: Date.now(),
        },
        { merge: true },
      );
    }
    return auth().signOut();
  }

  async sendPasswordReset(email) {
    return auth().sendPasswordResetEmail(email.trim());
  }

  getCurrentUser() {
    return auth().currentUser;
  }

  onAuthStateChanged(callback) {
    return auth().onAuthStateChanged(callback);
  }

  // --- USER PROFILE & PRESENCE METHODS ---

  async saveUserProfile(user) {
    const db = getFirestore();
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || '',
      email: user.email,
      online: true,
      lastSeen: Date.now(),
      createdAt: Date.now(),
    });
  }

  async markSipLoggedIn(user) {
    const db = getFirestore();
    const userRef = doc(db, 'users', user.uid);
    await setDoc(
      userRef,
      {
        sip: {
          loggedIn: true,
          registered: false,
          registrationAt: null,
        },
      },
      { merge: true },
    );
  }

  async updateOnlineStatus(uid, status) {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      online: status,
      lastSeen: Date.now(),
    });
  }

  getUsers(callback) {
    const db = getFirestore();
    return onSnapshot(collection(db, 'users'), snapshot => {
      if (snapshot) callback(snapshot);
    });
  }

  getUserRef(uid) {
    const db = getFirestore();
    return doc(db, 'users', uid);
  }

  // --- WEBRTC SIGNALING METHODS ---

  async createCallDoc({ callerId, calleeId, offer }) {
    const db = getFirestore();
    const callsRef = collection(db, 'calls');
    const callRef = doc(callsRef);

    const payload = {
      callerId,
      calleeId,
      callType: 'audio',
      status: 'ringing',
      offer: offer ? offer : null,
      answer: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(callRef, payload);
    return callRef.id;
  }

  async setOffer(callId, offer) {
    if (!callId) throw new Error('setOffer: callId is required');
    if (!offer?.sdp || !offer?.type) throw new Error('setOffer: invalid offer');

    const db = getFirestore();
    const callRef = doc(db, 'calls', callId);

    const payload = {
      offer: {
        type: String(offer.type),
        sdp: String(offer.sdp),
        callerId: offer.callerId ? String(offer.callerId) : null,
      },
      updatedAt: serverTimestamp(),
    };

    await setDoc(callRef, payload, { merge: true });
  }

  onAnswer(callId, cb) {
    if (!callId) throw new Error('onAnswer: callId is required');
    const db = getFirestore();
    const callRef = doc(db, 'calls', callId);
    return onSnapshot(callRef, snapshot => {
      if (!snapshot || typeof snapshot.data !== 'function') return;
      const data = snapshot.data();
      if (data && data.answer) cb(data.answer);
    });
  }

  async setAnswer(callId, answer) {
    if (!callId) throw new Error('setAnswer: callId is required');
    if (!answer?.sdp || !answer?.type) throw new Error('setAnswer: invalid answer');

    const db = getFirestore();
    const callRef = doc(db, 'calls', callId);

    const payload = {
      answer: {
        type: String(answer.type),
        sdp: String(answer.sdp),
        calleeId: answer.calleeId ? String(answer.calleeId) : null,
      },
      status: 'connected',
      updatedAt: serverTimestamp(),
    };

    await setDoc(callRef, payload, { merge: true });
  }

  async addIceCandidate(callId, candidate, role = 'caller') {
    if (!callId) throw new Error('addIceCandidate: callId is required');
    if (!candidate) return;

    const db = getFirestore();
    const callRef = doc(db, 'calls', callId);
    const normalized = typeof candidate.toJSON === 'function' ? candidate.toJSON() : candidate;

    const payload = {
      candidate: normalized,
      createdAt: serverTimestamp(),
    };

    const colName = role === 'caller' ? 'callerCandidates' : 'calleeCandidates';
    const colRef = collection(callRef, colName);
    await addDoc(colRef, payload);
  }

  listenRemoteIce(callId, role = 'caller', onAdd) {
    if (!callId) throw new Error('listenRemoteIce: callId is required');
    const db = getFirestore();
    const callRef = doc(db, 'calls', callId);
    const remoteCol = role === 'caller' ? 'calleeCandidates' : 'callerCandidates';
    const remoteColRef = collection(callRef, remoteCol);

    return onSnapshot(remoteColRef, snapshot => {
      if (!snapshot || typeof snapshot.docChanges !== 'function') return;
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data && data.candidate) onAdd(data.candidate);
        }
      });
    });
  }

  async hangup(callId) {
    if (!callId) return;
    const db = getFirestore();
    const callRef = doc(db, 'calls', callId);
    const subs = ['callerCandidates', 'calleeCandidates'];
    for (const name of subs) {
      const colRef = collection(callRef, name);
      const snap = await getDocs(colRef);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(callRef);
  }

  onCallReady(callId, cb) {
    if (!callId) throw new Error('onCallReady: callId is required');
    const db = getFirestore();
    const callRef = doc(db, 'calls', callId);
    return onSnapshot(callRef, snap => {
      if (!snap || typeof snap.data !== 'function') {
        cb({});
        return;
      }
      const data = snap.data();
      cb(data || {});
    });
  }

  getCallRef(callId) {
    const db = getFirestore();
    return doc(db, 'calls', callId);
  }

  getCallsCollection() {
    const db = getFirestore();
    return collection(db, 'calls');
  }

  async getLatestCallForCallee(localUserId) {
    const db = getFirestore();
    const q = query(
      collection(db, 'calls'),
      where('calleeId', '==', localUserId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    return snap.docs[0] || null;
  }

  async getDocData(docRef) {
    const snap = await getDoc(docRef);
    return snap.data();
  }

  listenIncomingCalls(uid, callback) {
    const db = getFirestore();
    const q = query(
      collection(db, 'calls'),
      where('calleeId', '==', uid),
      where('status', '==', 'ringing')
    );
    return onSnapshot(q, snapshot => {
      if (snapshot) callback(snapshot);
    });
  }

  async getUser(uid) {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    return snap.data() || null;
  }

  async getCall(callId) {
    const db = getFirestore();
    const callRef = doc(db, 'calls', callId);
    const snap = await getDoc(callRef);
    return snap.data() || null;
  }

  listenCall(callId, callback) {
    const db = getFirestore();
    const callRef = doc(db, 'calls', callId);
    return onSnapshot(callRef, snapshot => {
      if (snapshot) callback(snapshot);
    });
  }

  listenUser(uid, callback) {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid);
    return onSnapshot(userRef, snapshot => {
      if (snapshot) callback(snapshot);
    });
  }

  async saveUserFcmToken(uid, fcmToken) {
    const db = getFirestore();
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        fcmToken,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export const firestoreService = new FirestoreService();
export default firestoreService;
