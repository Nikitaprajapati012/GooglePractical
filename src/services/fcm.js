import messaging from '@react-native-firebase/messaging';
import firestoreService from './FirestoreService';

const PENDING_CALLS_KEY = 'pending_calls_v1';

function normalizePayload(remoteMessage) {
  const data = remoteMessage?.data || {};
  const type = data.type;

  if (type !== 'INCOMING_CALL') return null;

  const callId = data.callId || data.call_id || null;
  const remoteUserId =
    data.remoteUserId || data.callerId || data.caller_id || null;

  if (!callId) return null;

  return {
    type,
    callId,
    remoteUserId,
    raw: data,
  };
}

async function storePendingIncomingCall(message) {
  try {
    // Store minimal data so we can navigate on next app render.
    // We avoid depending on AsyncStorage here; instead use firestore as a fallback
    // only if needed. For now keep in-memory + global variable is set below.
    global.__PENDING_INCOMING_CALL__ = message;
  } catch {
    // ignore
  }
}

export function consumePendingIncomingCall() {
  const m = global.__PENDING_INCOMING_CALL__ || null;
  global.__PENDING_INCOMING_CALL__ = null;
  return m;
}

export async function registerUserFCMToken() {
  if (typeof messaging !== 'function') {
    console.log('[FCM] registerUserFCMToken skipped: messaging module is unavailable');
    return null;
  }

  const currentUser = firestoreService.getCurrentUser();
  const uid = currentUser?.uid;

  if (!uid) {
    console.log('[FCM] registerUserFCMToken skipped: not authenticated');
    return null;
  }

  // Request permission on iOS. Android usually prompts at runtime depending on setup.
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      // Still attempt to get token; depending on platform it might work.
      console.log('[FCM] permission not enabled', authStatus);
    }
  } catch (e) {
    // best-effort
    console.log('[FCM] requestPermission error', e?.message || String(e));
  }

  try {
    const fcmToken = await messaging().getToken();
    if (!fcmToken) return null;

    await firestoreService.saveUserFcmToken(uid, fcmToken);
    console.log('[FCM] registered token for uid', uid);
    return fcmToken;
  } catch (e) {
    console.log('[FCM] getToken or saveUserFcmToken error:', e?.message || String(e));
    return null;
  }
}

export async function setupFCMHandlers({ onIncomingCall } = {}) {
  if (typeof messaging !== 'function') {
    console.log('[FCM] setupFCMHandlers skipped: messaging module is unavailable');
    return () => {};
  }

  // Foreground messages
  const unsubOnMessage = messaging().onMessage(async remoteMessage => {
    const normalized = normalizePayload(remoteMessage);
    if (!normalized) return;

    console.log('[FCM] onMessage INCOMING_CALL', normalized);
    try {
      await storePendingIncomingCall(normalized);
    } catch {
      // ignore
    }

    onIncomingCall?.({
      callId: normalized.callId,
      remoteUserId: normalized.remoteUserId,
    });
  });

  // Background/quit messages: only reliable for notification payloads + headless handler.
  // react-native-firebase requires setBackgroundMessageHandler at top-level scope.
  try {
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      const normalized = normalizePayload(remoteMessage);
      if (!normalized) return;

      console.log('[FCM] background INCOMING_CALL', normalized);

      try {
        await storePendingIncomingCall(normalized);
      } catch {
        // ignore
      }

      // Background handler cannot navigate; we rely on consumePendingIncomingCall
      // when app is opened.
    });
  } catch (err) {
    console.log('[FCM] setBackgroundMessageHandler error', err);
  }

  // App opened from notification (quit -> open)
  const unsubscribeOpenedApp = messaging().onNotificationOpenedApp(
    async remoteMessage => {
      const normalized = normalizePayload(remoteMessage);
      if (!normalized) return;

      console.log('[FCM] onNotificationOpenedApp INCOMING_CALL', normalized);
      try {
        await storePendingIncomingCall(normalized);
      } catch {
        // ignore
      }

      onIncomingCall?.({
        callId: normalized.callId,
        remoteUserId: normalized.remoteUserId,
      });
    },
  );

  // Token refresh
  const unsubscribeTokenRefresh = messaging().onTokenRefresh(async () => {
    try {
      await registerUserFCMToken();
    } catch (e) {
      console.log('[FCM] onTokenRefresh error', e?.message || String(e));
    }
  });

  return () => {
    try {
      unsubOnMessage?.();
    } catch {
      // ignore
    }
    try {
      unsubscribeOpenedApp?.();
    } catch {
      // ignore
    }
    try {
      unsubscribeTokenRefresh?.();
    } catch {
      // ignore
    }
  };
}
