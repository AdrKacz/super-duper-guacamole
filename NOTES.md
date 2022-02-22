# Notes

*This file stores various notes about the current status of the project, such as todo's items, item to keep an eye on, errors to correct, or ideas for improvement.*

---

**TODO** Update *Notifee* for Android

**WARN** Too many re-renders

**WARN** Error on *hot-reload*, user are not persistent

**WARN** No local storage according to *GunDB*

**TODO** Manual to join the development of the app

**TODO** Build a working version for *Android*

**TODO** Release the app for *Android*

**WARN** *FCM* centralised the flow of messages, that doesn't ensure *privacy* first principle.

**WARN** Notifications seem to need to open the app once before begin received and processed ...
 - Example: open a emulator, send message > nothing on iPhone, go the app (receive notifications -*why just knoz, and just one*-), quit the application, send a message with the emulator, and here you go you get the notification ! As if the token isn't working before you open the app.

**ERROR** `[notifee] no background event handler has been set. Set a handler via the "onBackgroundEvent" method.`

**ERROR** Chat messages -stored in *GunDB*- are not saved accross sessions (although tokens seems to be)