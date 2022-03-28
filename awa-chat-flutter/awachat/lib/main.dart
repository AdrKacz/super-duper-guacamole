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

import 'package:hive_flutter/hive_flutter.dart';

// ===== ===== =====
// Endpoints
const String matchmakerEndpoint = "http://13.37.214.198:8080/room/";
// ===== ===== =====

// ===== ===== =====
// Room
class Room {
  final int id;
  final String ipAddress;
  final int port;
  late WebSocketChannel channel;

  Room({
    required this.id,
    required this.ipAddress,
    required this.port,
  });

  factory Room.fromJson(Map<String, dynamic> json) {
    print("[Room] Create from ${json.toString()}");
    // Create room
    return Room(
      id: json["room_id"],
      ipAddress: json["room_address"],
      port: json["room_port"],
    );
  }

  void connectRoom() {
    channel = WebSocketChannel.connect(Uri.parse("ws://$ipAddress:$port"));
    print("[Room] Connected to ws://$ipAddress:$port");
  }

  Future<void> subscribeTopic() async {
    await FirebaseMessaging.instance.subscribeToTopic('room-$id');
    print('Subscribed to Firebase topic <room-$id>');
  }

  Future<void> unsubscribeTopic() async {
    await FirebaseMessaging.instance.unsubscribeFromTopic('room-$id');
    print('Unsbscribed from Firebase topic <room-$id>');
  }

  void sendMessage(types.PartialText message) {
    print("Send message to $ipAddress:$port");
    channel.sink.add("${user.id}::${message.text}");
  }

  void saveRoom() {
    boxRoom.put('id', id.toString());
    boxRoom.put('ipAddress', ipAddress);
    boxRoom.put('port', port.toString());
  }

  // TODO: Override ondelete > disconnect
}

Future<Room> loadRoom() async {
  print("Load room from disk");
  // Wait to prevent errors
  await Future.delayed(const Duration(seconds: 1), () {});
  String? id = boxRoom.get('id');
  String? ipAddress = boxRoom.get('ipAddress');
  String? port = boxRoom.get('port');
  if (id != null && ipAddress != null && port != null) {
    return Room.fromJson({
      "room_id": int.parse(id),
      "room_address": ipAddress,
      "room_port": int.parse(port)
    });
  } else {
    return Future.error(
        "Impossible de se connecter à la conversation en cours");
  }
}

Future<Room> fetchRoom() async {
  print("Fetch room to ${Uri.parse(matchmakerEndpoint + user.id)}");

  final response = await http.get(Uri.parse(matchmakerEndpoint + user.id));

  final body = jsonDecode(response.body);
  //TODO: use statusCode instead of error (200 vs 204)
  if (body["error"] == "") {
    // TODO: Await in parrallel
    // Create Room
    Room room = Room.fromJson(body);

    // Wait to prevent errors
    await Future.delayed(const Duration(seconds: 1), () {});
    // Connect to Firebase Room Topic
    await room.subscribeTopic();
    // Update Room box
    room.saveRoom();
    // Update Room messages
    lazyBoxMessages.clear();
    boxRoom.put("end", "0"); // TODO: verify it correctly erase disk
    return room;
  } else {
    return Future.error(
        "Impossible de se connecter à une nouvelle conversation");
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
// Disk management
late types.User user;
late Box<String> boxRoom;
late LazyBox<String> lazyBoxMessages;
late Box<String> boxUser;

types.Message messageFrom(List<String> data) {
  return types.TextMessage(
    author: types.User(id: data[0]),
    createdAt: DateTime.now().millisecondsSinceEpoch,
    id: randomString(),
    text: data[1],
  );
}

Future<List<types.Message>> loadMessages() async {
  List<types.Message> messages = [];

  for (int i = 0; i < int.parse(boxRoom.get('end') ?? '0'); i++) {
    String partial = await lazyBoxMessages.getAt(i) ?? "::";
    List<String> data = partial.split(RegExp(r"::"));
    messages.insert(0, messageFrom(data));
  }
  return messages;
}

// ===== ===== =====

// ===== ===== =====
// App initialisation
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  await Hive.initFlutter();
  boxRoom = await Hive.openBox<String>('room');
  lazyBoxMessages = await Hive.openLazyBox<String>('messages');
  boxUser = await Hive.openBox<String>('user');

  // Set user
  String? userId = boxUser.get('id');
  if (userId == null) {
    user = types.User(id: uuid.v4());
    boxUser.put('id', user.id);
  } else {
    user = types.User(id: userId);
  }
  print("User ID is <${user.id}>.");

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  static FirebaseMessaging messaging = FirebaseMessaging.instance;

  @override
  Widget build(BuildContext context) {
    final pushNotificationService = PushNotificationService(messaging);
    pushNotificationService.initialise();
    if (boxUser.get('hasSignedAgreements') == null) {
      return const MaterialApp(
        home: MyAppPresentation(),
      );
    } else {
      return const MaterialApp(
        home: MyHomePage(),
      );
    }
  }
}
// ===== ===== =====

// ===== ===== =====

const List<Widget> slides = <Widget>[
  Slide(text: """
Je suis Awa.
Je vais te présenter l'application.
"""),
  Slide(
      text:
          "Chaque personne est placée dans une conversation avec quatres autres personnes."),
  Slide(text: """
Tu ne t'occupes de rien !
C'est moi qui te place en fonction de tes préférences.
"""),
  RGPDSlide(),
  EULASlide(),
];

class MyAppPresentation extends StatelessWidget {
  const MyAppPresentation({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        body: SafeArea(
            child: DefaultTabController(
      length: slides.length,
      // Use a Builder here, otherwise `DefaultTabController.of(context)` below
      // returns null.
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const <Widget>[
          Expanded(
            child: TabBarView(children: slides),
          ),
          TabPageSelector(),
        ],
      ),
    )));
  }
}

class SlideContainer extends StatelessWidget {
  const SlideContainer({Key? key, required this.child}) : super(key: key);

  final Widget child;
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Center(
        child: child,
      ),
    );
  }
}

class Slide extends StatelessWidget {
  const Slide({Key? key, required this.text}) : super(key: key);

  final String text;
  @override
  Widget build(BuildContext context) {
    return SlideContainer(
      child: Text(
        text,
        textAlign: TextAlign.center,
      ),
    );
  }
}

class RGPDSlide extends StatelessWidget {
  const RGPDSlide({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: ListView(
      shrinkWrap: true,
      children: [
        Text("""
Je m'engage à ne pas conserver tes données personnelles.
  🔐 Les messages s'enregistrent uniquement sur ton téléphone,
  🔐 Quand tu changes de conversation, tout est supprimé,
  🔐 Tu n'as pas de profil, tu peux changer d'identité à tout moment.

Si tu te demandes comment je te trouve une conversation engagente et amusante sans ne rien savoir sur toi, je t'invite à venir voir comment je fonctionne et me poser une question 🌍
""", textAlign: TextAlign.center),
        ElevatedButton(
            onPressed: () {}, child: Text("Comment je fonctionne ? 🧠")),
        ElevatedButton(onPressed: () {}, child: Text("J'ai compris 👍"))
      ],
    ));
  }
}

class EULASlide extends StatelessWidget {
  const EULASlide({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: Center(
            child: ListView(
      shrinkWrap: true,
      children: [
        Text("""
Je ne respecterai mes engagements seulement si tu es respecteux et tolérant.

Tu dois t'engager à :
  ✅ ne pas envoyer de messages insultants,
  ✅ respecter chaque personnes, quelque soit vos divergences.

De plus, si tu planifie un rendez-vous dans le monde réel avec les membres de ta conversations, tu dois t'engager à :
  ✅ ne pas effectuer d'actions reprimendables par la loi avec ton groupe,
  ✅ ne pas mentir sur les tenants de la rencontre dans le but de pieger un ou plusieurs membre.

Tu t'engages à bien respecter cela ?
""", textAlign: TextAlign.center),
        ElevatedButton(onPressed: () {}, child: Text("Je m'engage 😎"))
      ],
    )));
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
  final List<types.Message> _messages = [];

  Future<void> localLoadMessages() async {
    List<types.Message> loadedMessages = await loadMessages();
    print("Loaded messages: $loadedMessages");
    setState(() {
      _messages.addAll(loadedMessages);
    });
  }

  // Init
  @override
  void initState() {
    super.initState();
    String? roomId = boxRoom.get("id");
    if (roomId != null) {
      futureRoom = loadRoom();
      localLoadMessages();
    } else {
      futureRoom = fetchRoom();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar:
          AppBar(backgroundColor: const Color(0xff1d1c21), actions: <Widget>[
        PopupMenuButton<int>(onSelected: (int result) {
          setState(() {
            _messages.clear();
            futureRoom = fetchRoom();
          });
        }, itemBuilder: (BuildContext context) {
          return [
            const PopupMenuItem<int>(
                value: 0, child: Text("Je veux changer de groupe")),
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
                  roomSnapshot.data!.connectRoom(); // TODO: verify connection
                  return StreamBuilder(
                    stream: roomSnapshot.data!.channel.stream,
                    builder: (context, snapshot) {
                      if (snapshot.hasData) {
                        print("Raw data received: ${snapshot.data}");
                        String dataString = snapshot.data.toString();
                        List<String> data = dataString.split(RegExp(r"::"));
                        print("\tData received: $data");
                        if (data.length == 2) {
                          // Add message
                          _messages.insert(0, messageFrom(data));
                          // Store message in disk (lazy)
                          lazyBoxMessages.add(dataString);
                          int end = int.parse(boxRoom.get("end") ?? "0");
                          boxRoom.put("end", (end + 1).toString());
                        }
                      }
                      return Chat(
                        messages: _messages,
                        onSendPressed: roomSnapshot.data!.sendMessage,
                        user: user,
                      );
                    },
                  );
                } else if (roomSnapshot.hasError) {
                  return Center(
                      child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: <Widget>[
                        Text(roomSnapshot.error.toString()),
                        ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              primary: const Color(0xff1d1c21),
                            ),
                            onPressed: () {
                              setState(() {
                                _messages.clear();
                                futureRoom = fetchRoom();
                              });
                            },
                            child: const Text("Cherche une conversation"))
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
