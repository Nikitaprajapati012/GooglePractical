import { useEffect } from 'react';
import { AppState } from 'react-native';

import firestoreService from '../services/FirestoreService';

export default function usePresence() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async state => {
      const user = firestoreService.getCurrentUser();

      if (!user?.uid) return;

      // Keep the existing app’s Firestore field: users/{uid}.online
      try {
        if (state === 'active') {
          await firestoreService.updateOnlineStatus(user.uid, true);
        } else {
          await firestoreService.updateOnlineStatus(user.uid, false);
        }
      } catch {
        // best-effort presence update
      }
    });

    return () => subscription.remove();
  }, []);
}
