const messaging = () => {
  return {
    requestPermission: async () => 'authorized',
    getToken: async () => 'test-fcm-token',
    onMessage: () => () => {},
    onNotificationOpenedApp: () => () => {},
    onTokenRefresh: () => () => {},
    setBackgroundMessageHandler: () => {},
  };
};

messaging.AuthorizationStatus = {
  AUTHORIZED: 'AUTHORIZED',
  PROVISIONAL: 'PROVISIONAL',
};

module.exports = messaging;
