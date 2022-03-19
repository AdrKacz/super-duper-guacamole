import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_chat_ui/flutter_chat_ui.dart';
import 'package:uuid/uuid.dart';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:http/http.dart' as http;

// ===== ===== =====
// Endpoints
const String matchmakerEndpoint = "http://192.168.1.15:8080/room/";
// const String matchmakerEndpoint = "http://13.37.214.198:8080/room/";
// ===== ===== =====

// ===== ===== =====
// Room
class Room {
  final String ipAddress;
  final int port;
  WebSocketChannel? channel;

  Room({
    required this.ipAddress,
    required this.port,
  });

  factory Room.fromJson(Map<String, dynamic> json) {
    print("Create room with ${json["room_address"]}:${json["room_port"]}");
    // Create room
    return Room(
      ipAddress: json["room_address"],
      port: json["room_port"],
    );
  }

  void connectRoom() {
    print("Connect to room ws://$ipAddress:$port");
    channel = WebSocketChannel.connect(Uri.parse("ws://$ipAddress:$port"));
  }

  // TODO: Override ondelete
}

Future<Room> fetchRoom(String userId) async {
  final response = await http.get(Uri.parse(matchmakerEndpoint + userId));

  final body = jsonDecode(response.body);
  //TODO: use statusCode instead of error (200 vs 204)
  if (body["error"] == "") {
    // TODO: Await in parrallel
    // Create Room
    await Future.delayed(const Duration(seconds: 1), () {});
    // Connect to Firebase Room Topic
    print('Connect to Firebase topic room-${body['room_id']}');
    await FirebaseMessaging.instance
        .subscribeToTopic('room-${body['room-id']}');
    return Room.fromJson(body);
  } else {
    return Future.error("Failed to load room");
  }
}
// ===== ===== =====

// ===== ===== =====
// uuid
Uuid uuid = const Uuid();
String randomString() {
  final random = Random.secure();
  final values = List<int>.generate(16, (i) => random.nextInt(255));
  return base64UrlEncode(values);
}
// ===== ===== =====

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

    print('User granted permission: ${settings.authorizationStatus}');

    String? token = await messaging.getToken();
    print("Firebase messaging token: <$token>");
  }
}

// ===== ===== =====

// ===== ===== =====
// App initialisation
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  static FirebaseMessaging messaging = FirebaseMessaging.instance;

  @override
  Widget build(BuildContext context) {
    final pushNotificationService = PushNotificationService(messaging);
    pushNotificationService.initialise();
    return const MaterialApp(
      home: MyHomePage(),
    );
  }
}
// ===== ===== =====

// ===== ===== =====
// Home Page
class MyHomePage extends StatefulWidget {
  const MyHomePage({Key? key}) : super(key: key);

  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  // WebSocket room
  late Future<Room> futureRoom;

  // Messages
  // TODO: history is kept between room (problem)
  final List<types.Message> _messages = [];
  final _user = types.User(id: uuid.v4());

  // Init
  @override
  void initState() {
    super.initState();
    futureRoom = fetchRoom(_user.id);
  }

  //TODO: Change room in AppBar ONLY if already connected
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar:
          AppBar(backgroundColor: const Color(0xff1d1c21), actions: <Widget>[
        PopupMenuButton<int>(onSelected: (int result) {
          setState(() {
            futureRoom = fetchRoom(_user.id);
          });
        }, itemBuilder: (BuildContext context) {
          return [
            const PopupMenuItem<int>(value: 0, child: Text("Change room")),
          ];
        })
      ]),
      body: SafeArea(
          bottom: false,
          child: FutureBuilder<Room>(
            future: futureRoom,
            builder: (roomContext, roomSnapshot) {
              print(roomSnapshot);
              if (roomSnapshot.connectionState == ConnectionState.done) {
                if (roomSnapshot.hasData) {
                  // Connect to room
                  // TODO: verify connection
                  roomSnapshot.data!.connectRoom();
                  print(
                      "Connected to room ${roomSnapshot.data!.ipAddress}:${roomSnapshot.data!.port}");
                  return StreamBuilder(
                    stream: roomSnapshot.data!.channel!.stream,
                    builder: (context, snapshot) {
                      if (snapshot.hasData) {
                        print(snapshot.data);
                        List<String> data =
                            snapshot.data.toString().split(RegExp(r"::"));
                        print(data);
                        if (data.length == 2) {
                          _messages.insert(
                              0,
                              types.TextMessage(
                                author: types.User(id: data[0]),
                                createdAt:
                                    DateTime.now().millisecondsSinceEpoch,
                                id: randomString(),
                                text: data[1],
                              ));
                        }
                      }
                      return Chat(
                        messages: _messages,
                        onSendPressed: (types.PartialText message) {
                          print(
                              "Send message to ${roomSnapshot.data!.ipAddress}:${roomSnapshot.data!.port}");
                          roomSnapshot.data!.channel!.sink
                              .add("${_user.id}::${message.text}");
                        },
                        user: _user,
                      );
                    },
                  );
                } else if (roomSnapshot.hasError) {
                  return Center(
                      child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: <Widget>[
                        const Text("You didn't find any room"),
                        ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              primary: const Color(0xff1d1c21),
                            ),
                            onPressed: () {
                              setState(() {
                                futureRoom = fetchRoom(_user.id);
                              });
                            },
                            child: const Text("Retry"))
                      ]));
                }
              }
              return const Center(child: CircularProgressIndicator());
            },
          )),
    );
  }
}
// ===== ===== =====