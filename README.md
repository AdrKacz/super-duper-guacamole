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
 - Google-services.json added, still not working

TODO: Remove FCM, we don't want the messages to be centralised (don't know how to do if not for now)

WARN: Notifications seem to need to open the app once before begin received and processed ...
 - Example: open a emulator, send message > nothing on iPhone, go the app (receive notifications -*why just knoz, and just one*-), quit the application, send a message with the emulator, and here you go you get the notification ! As if the token isn't working before you open the app.

ERROR: [notifee] no background event handler has been set. Set a handler via the "onBackgroundEvent" method.

TODO: Chat message are not saved betweend successives runs, but tokens are (well.. kind of annoying)