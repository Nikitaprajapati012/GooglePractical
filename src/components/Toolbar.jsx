import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import firestoreService from '../services/FirestoreService';
import Ionicons from 'react-native-vector-icons/Ionicons';

function SipBadge({ online, loggedIn }) {
  return null;
}

export default function Toolbar({ onSignOutPress }) {
  const [sipLoggedIn, setSipLoggedIn] = useState(true);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const uid = firestoreService.getCurrentUser()?.uid;
    if (!uid) return;

    const unsub = firestoreService.listenUser(uid, snap => {
      const data = snap?.data() || {};
      const sip = data?.sip || {};
      setSipLoggedIn(sip?.loggedIn !== false);
      setOnline(!!data?.online);
    });

    return () => unsub?.();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GooglePractical</Text>
      <SipBadge online={online} loggedIn={sipLoggedIn} />
      {onSignOutPress ? (
        <TouchableOpacity
          onPress={onSignOutPress}
          style={styles.signOutBtn}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: '#070b14',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  title: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  badge: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  signOutBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
});
