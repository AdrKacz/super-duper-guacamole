import 'dart:convert';

import 'package:awachat/websocketconnection.dart';
import 'package:awachat/flyer/l10n.dart';
import 'package:awachat/message.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/memory.dart';
import 'package:awachat/user.dart';
import 'package:awachat/pages/agreements/agreements.dart';

import 'package:flutter_chat_ui/flutter_chat_ui.dart';

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
          print("Sign Agreements");
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

// Debug
const Map<String, String> groupNames = {
  "0": "Zero",
  "1": "Ichi",
  "2": "Ni",
  "3": "San",
  "4": "Yon",
  "5": "Go",
  "6": "Roku",
  "7": "Nana",
  "8": "Hachi",
  "9": "Kyu",
};

// Main Page
class MainPage extends StatefulWidget {
  const MainPage({Key? key, required this.unsignAgreements}) : super(key: key);

  final VoidCallback? unsignAgreements;

  @override
  _MainPageState createState() => _MainPageState();
}

class _MainPageState extends State<MainPage> {
  // Channel
  final WebSocketConnection _webSocketConnection = WebSocketConnection();

  // Messages
  final List<types.Message> _messages = [];

  // Status
  String status = "idle";

  Future<void> loadMessagesFromMemory() async {
    final List<types.Message> m = await Memory().loadMessages();
    setState(() {
      _messages.addAll(m);
    });
  }

  // Init
  @override
  void initState() {
    super.initState();
    _webSocketConnection.register();
    if (User().groupid == "") {
      _webSocketConnection.switchgroup();
      status = "switching";
    } else {
      loadMessagesFromMemory();
      status = "chat";
    }

    _webSocketConnection.stream.listen((message) {
      print("Receives: $message");
      final data = jsonDecode(message);
      switch (data['action']) {
        case "register":
          print('\tRegister: ${data['status']}');
          break;
        case "switchgroup":
          print('\tGroup: ${data['groupid']}');
          User().groupid = data['groupid'];
          setState(() {
            status = "chat";
          });
          break;
        case "sendmessage":
          print('\tData: ${data['data']}');
          types.Message? message = messageDecode(data['data']);
          if (message != null) {
            setState(() {
              _messages.insert(0, message);
            });
            Memory().addMessage(data['data']);
          }
          break;
        default:
          print("\tAction ${data['action']} not recognised.");
          setState(() {
            status = "";
          });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    print("Status: $status");
    return Scaffold(
        appBar: AppBar(
            foregroundColor: const Color(0xff6f61e8),
            backgroundColor: const Color(0xfff5f5f7),
            title: Text(groupNames[User().groupid] ?? ""),
            actions: <Widget>[
              PopupMenuButton<int>(onSelected: (int result) {
                if (result == 0) {
                  _webSocketConnection.switchgroup();
                  setState(() {
                    _messages.clear();
                    status = "switch";
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
            child: Builder(
              builder: (BuildContext context) {
                switch (status) {
                  case "idle":
                    return const Center(
                        child: CircularProgressIndicator(
                            color: Color.fromARGB(255, 21, 220, 223)));
                  case "switch":
                    return const Center(
                        child: CircularProgressIndicator(
                            color: Color(0xff6f61e8)));
                  case "chat":
                    return Chat(
                      l10n: const ChatL10nFr(),
                      messages: _messages,
                      onSendPressed: _webSocketConnection.sendmessage,
                      user: User().user,
                      theme: const DefaultChatTheme(
                          inputBackgroundColor: Color(0xfff5f5f7),
                          inputTextColor: Color(0xff1f1c38),
                          inputTextCursorColor: Color(0xff9e9cab)),
                    );
                  default:
                    return const Center(
                        child: CircularProgressIndicator(
                            color: Color.fromARGB(255, 223, 21, 31)));
                }
              },
            )));
  }

  @override
  void dispose() {
    print("Dispose");
    _webSocketConnection.close();
    super.dispose();
  }
}
