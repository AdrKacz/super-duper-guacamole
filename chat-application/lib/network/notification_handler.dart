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

    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    final String? token = await FirebaseMessaging.instance.getToken();

    if (token != null) {
      await HttpConnection().legacyPut('firebase-token', {'token': token});
    }
  }
}
