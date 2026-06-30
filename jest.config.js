module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },

  // RN + test environment: we don't want Jest to evaluate Firestore's ESM build.
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-screens|react-native-safe-area-context)/)',
  ],

  setupFilesAfterEnv: [],

  moduleNameMapper: {
    // Avoid parsing ESM exports from @react-native-firebase/* in Jest.
    '^@react-native-firebase/messaging$':
      '<rootDir>/__tests__/__mocks__/messaging.js',
    '^@react-native-firebase/firestore$':
      '<rootDir>/__tests__/__mocks__/firestore.js',
    '^@react-native-firebase/auth$': '<rootDir>/__tests__/__mocks__/auth.js',

    // react-native-vector-icons ships ESM; mock for unit tests.
    '^react-native-vector-icons/(.*)$':
      '<rootDir>/__tests__/__mocks__/vectorIconsMock.js',

    // Some components import via scoped package; mock those too.
    '^@react-native-vector-icons/(.*)$':
      '<rootDir>/__tests__/__mocks__/vectorIconsMock.js',

    // react-native-webrtc requires a native environment; mock it for unit tests.
    '^react-native-webrtc$': '<rootDir>/__tests__/__mocks__/webrtcMock.js',

    // react-native-splash-screen ships ESM; mock it for Jest unit tests.
    '^react-native-splash-screen$':
      '<rootDir>/__tests__/__mocks__/reactNativeSplashScreenMock.js',
  },

  // Prevent Jest from treating mock files as test suites.
  testPathIgnorePatterns: ['/__tests__/__mocks__/'],
};
