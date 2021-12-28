# super-duper-guacamole
Application to meet new group of people

Development Branch, decentralised application.

### Notes

* Cannot run on Android (run `npx react-native run-android` when possible to update for Notifee)

> TODO: Detailed steps and errors

* Too many re-renders

Not working with hot-reload (user not persistent)

No local storage

TODO: How to publish / build

TODO: Firebase Android Setup not done (only iOS for now)

TODO: Remove FCM, we don't want the messages to be centralised (don't know how to do if not for now)

ERROR: [notifee] no background event handler has been set. Set a handler via the "onBackgroundEvent" method.

TODO: Token ID are store and append each time, so many time the same one at each connection (may result in problem in memory in prod, for exemple, only with 2 devices, if they restart 10 times the app each, that will be 20 entries, but only 2 differents values) => see in `saveToken` function

WARN: Something don't receive notification for no real reason (use case found below, but not reproductible)

1.  Open Snap, listen Audio, send notificaion with other device -> no notification
2.  Then, go to App, send notificaion with other device -> receive notification in app
3.  Then, go back to Snap, listen Audio, send notification with other device -> receive notification (well ...)

TODO: Chat message are not saved betweend successives runs, but tokens are (well.. kind of annoying)