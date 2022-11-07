import 'package:awachat/network/http_connection.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_core/firebase_core.dart';
import '../firebase_options.dart';

class NotificationHandler {
  static final NotificationHandler _instance = NotificationHandler._internal();

  factory NotificationHandler() {
    return _instance;
  }

  NotificationHandler._internal();

  Future<void> init() async {
    // TODO: if app is offline, it will crashes
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    // don't use await to not block main thread
    FirebaseMessaging.instance
        .requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    )
        .then((NotificationSettings settings) {
      // user granted permission (see settings.authorizationStatus)
      return FirebaseMessaging.instance.getToken();
    }).then((String? token) async {
      if (token == null) {
        return null;
      } else {
        await HttpConnection().legacyPut('firebase-token', {'token': token});
      }
    });
  }
}
