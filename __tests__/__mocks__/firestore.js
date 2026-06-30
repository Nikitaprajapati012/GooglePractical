// Minimal ESM-compatible mock so Jest doesn't try to evaluate @react-native-firebase/firestore.
const firestoreMock = {
  collection: () => ({
    doc: () => ({
      set: async () => undefined,
      update: async () => undefined,
      get: async () => ({ data: () => ({}) }),
      delete: async () => undefined,
      collection: () => ({
        add: async () => undefined,
        onSnapshot: () => ({ unsubscribe: () => undefined }),
      }),
    }),
    onSnapshot: () => ({ unsubscribe: () => undefined }),
    orderBy: () => ({ onSnapshot: () => ({ unsubscribe: () => undefined }) }),
  }),
  batch: () => ({
    delete: () => undefined,
    commit: async () => undefined,
  }),
  FieldValue: {
    serverTimestamp: () => new Date().toISOString(),
  },
};

export default function firestore() {
  return firestoreMock;
}

export { firestoreMock };
