import 'dart:convert';
import 'dart:typed_data';

import 'package:awachat/store/user.dart';
import 'package:awachat/pointycastle/helpers.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_core/firebase_core.dart';
import '../firebase_options.dart';
import 'package:http/http.dart' as http;

class NotificationHandler {
  static const String _httpEndpoint =
      String.fromEnvironment('NOTIFICATION_HTTP_ENDPOINT');

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
    }).then((String? token) {
      if (token == null) {
        return null;
      } else {
        return putToken(token);
      }
    });
  }

  Future<void> putToken(String token) {
    int timestamp = DateTime.now().millisecondsSinceEpoch;
    Uint8List signature = rsaSign(User().pair.privateKey,
        Uint8List.fromList((User().id + timestamp.toString()).codeUnits));
    return http
        .put(Uri.parse(_httpEndpoint),
            body: jsonEncode({
              'id': User().id,
              'token': token,
              'signature': signature,
              'timestamp': timestamp,
              'publicKey': encodePublicKeyToPem(User().pair.publicKey)
            }))
        .then((http.Response response) {
      // response status in response.statusCode
    });
  }
}
