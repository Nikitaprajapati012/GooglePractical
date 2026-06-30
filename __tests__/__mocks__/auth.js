// Minimal ESM-compatible mock so Jest doesn't try to evaluate @react-native-firebase/auth.
const authMock = {
  onAuthStateChanged: () => () => undefined,
  signInWithEmailAndPassword: async () => ({
    user: {
      uid: 'uid',
      email: 'email@test.com',
      displayName: 'Test',
    },
  }),
  createUserWithEmailAndPassword: async () => ({
    user: {
      uid: 'uid',
      email: 'email@test.com',
      displayName: 'Test',
    },
  }),
  sendPasswordResetEmail: async () => undefined,
  signOut: async () => undefined,
  currentUser: null,
};

export default function auth() {
  return authMock;
}

export { authMock };
