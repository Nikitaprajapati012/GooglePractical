# FCM: Incoming Call Notification + Token Registration

- [ ] Wire FCM token registration + message listeners in `App.jsx`
- [ ] Add incoming-call handler to navigate to `IncomingCall` when a call notification arrives
- [ ] Ensure pending call data is available when app is opened from background
- [ ] (Server-side) Send FCM with `data.type=INCOMING_CALL`, `data.callId`, `data.remoteUserId`
