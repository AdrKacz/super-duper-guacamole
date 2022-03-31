import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/room.dart';
import 'package:awachat/memory.dart';
import 'package:awachat/user.dart';
import 'package:awachat/pages/chat.dart';
import 'package:awachat/pages/error.dart';
import 'package:awachat/pages/agreements/agreements.dart';

// ===== ===== =====
// Firebase Push Notification
class PushNotificationService {
  final FirebaseMessaging messaging;

  PushNotificationService(this.messaging);

  Future initialise() async {
    NotificationSettings settings = await messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    print(
        '[PushNotificationService] User granted permission: ${settings.authorizationStatus}');

    String? token = await messaging.getToken();
    print("[PushNotificationService] Firebase messaging token: <$token>");
  }
}
// ===== ===== =====

// ===== ===== =====
// App initialisation
late types.User user;
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  await Memory().init();
  await User().init();

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  static FirebaseMessaging messaging = FirebaseMessaging.instance;

  // State
  late bool hasSignedAgreements;

  @override
  void initState() {
    super.initState();

    hasSignedAgreements = false;
    String? savedHasSignedAgreements =
        Memory().get('user', 'hasSignedAgreements');
    if (savedHasSignedAgreements != null &&
        savedHasSignedAgreements == "true") {
      hasSignedAgreements = true;
    }

    PushNotificationService(messaging).initialise();
  }

  @override
  Widget build(BuildContext context) {
    if (hasSignedAgreements) {
      return MaterialApp(
        home: MainPage(unsignAgreements: () {
          setState(() {
            hasSignedAgreements = false;
          });
          Memory().put('user', 'hasSignedAgreements', "false");
        }),
      );
    } else {
      return MaterialApp(
        home: AgreementPage(signAgreements: () {
          setState(() {
            hasSignedAgreements = true;
          });
          Memory().put('user', 'hasSignedAgreements', "true");
        }),
      );
    }
  }
}
// ===== ===== =====

// ===== ===== =====
// Main Page
class MainPage extends StatefulWidget {
  const MainPage({Key? key, required this.unsignAgreements}) : super(key: key);

  final VoidCallback? unsignAgreements;

  @override
  _MainPageState createState() => _MainPageState();
}

class _MainPageState extends State<MainPage> {
  // Messages
  late Future<Room> room;

  // Init
  @override
  void initState() {
    super.initState();

    String? roomId = Memory().get('room', 'id');
    if (roomId != null) {
      room = Room().load();
    } else {
      room = Room().fetch();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          foregroundColor: const Color(0xff6f61e8),
          backgroundColor: const Color(0xfff5f5f7),
          actions: <Widget>[
            PopupMenuButton<int>(onSelected: (int result) {
              if (result == 0) {
                setState(() {
                  room = Room().fetch();
                });
              } else if (result == 1) {
                widget.unsignAgreements!();
              }
            }, itemBuilder: (BuildContext context) {
              return [
                const PopupMenuItem<int>(
                    value: 0, child: Text("Je veux changer de groupe")),
                const PopupMenuItem<int>(
                    value: 1, child: Text("Je veux revoir la présentation")),
              ];
            })
          ]),
      body: SafeArea(
          bottom: false,
          child: FutureBuilder<Room>(
              future: room,
              builder: (BuildContext context, AsyncSnapshot<Room> snapshot) {
                print("RECEIVE SNAPSHOT: $snapshot");
                if (snapshot.connectionState == ConnectionState.done) {
                  if (snapshot.hasData) {
                    return ChatPage(
                      stream: Room().channel!.stream,
                    );
                  } else if (snapshot.hasError) {
                    return ErrorPage(onPressed: () {
                      setState(() {
                        room = Room().fetch();
                      });
                    });
                  }
                }
                return const Center(
                    child: CircularProgressIndicator(color: Color(0xff6f61e8)));
              })),
    );
  }
}
