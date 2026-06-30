export const mediaDevices = {
  getUserMedia: async () => ({
    getTracks: () => [],
    getAudioTracks: () => [],
    getVideoTracks: () => [],
  }),
};

export class RTCPeerConnection {
  constructor() {}
  close() {}
}

export const RTCView = () => null;
