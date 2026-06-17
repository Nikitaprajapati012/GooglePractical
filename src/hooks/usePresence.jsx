import { useEffect } from 'react';
import { AppState } from 'react-native';
import auth from '@react-native-firebase/auth';
import FirestoreService from '../services/FirestoreService';

export default function usePresence() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async state => {
      const user = auth().currentUser;

      if (!user) {
        return;
      }

      if (state === 'active') {
        await FirestoreService.updateOnlineStatus(user.uid, true);
      } else {
        await FirestoreService.updateOnlineStatus(user.uid, false);
      }
    });

    return () => subscription.remove();
  }, []);
}
