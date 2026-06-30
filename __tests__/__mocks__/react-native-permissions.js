export const PERMISSIONS = {
  ANDROID: {
    CAMERA: 'android.permission.CAMERA',
    RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
  },
};

export const RESULTS = {
  GRANTED: 'granted',
  DENIED: 'denied',
};

export const request = jest.fn(() => Promise.resolve(RESULTS.GRANTED));

export const check = jest.fn(() => Promise.resolve(RESULTS.GRANTED));
