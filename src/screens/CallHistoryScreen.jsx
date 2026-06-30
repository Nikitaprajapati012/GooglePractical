import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CallHistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Call History</Text>
      <Text style={styles.subtitle}>Phase 1 placeholder.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { marginTop: 8, color: '#666' },
});
