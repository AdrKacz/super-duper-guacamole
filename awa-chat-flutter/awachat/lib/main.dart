import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_chat_ui/flutter_chat_ui.dart';
import 'package:uuid/uuid.dart';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:http/http.dart' as http;

// Endpoints
// TODO: correct user_id
// const String matchmakerEndpoint = "http://13.37.214.198:8080/room/1";

const String matchmakerEndpoint =
    "http://172.20.10.3:8080/room/1"; // TODO: correct user_id

// Room
class Room {
  final String ipAddress;
  final int port;
  final WebSocketChannel channel;

  const Room({
    required this.ipAddress,
    required this.port,
    required this.channel,
  });

  factory Room.fromJson(Map<String, dynamic> json) {
    print("Create room with room ${json["room_address"]}:${json["room_port"]}");
    WebSocketChannel channel = WebSocketChannel.connect(
        Uri.parse("ws://${json["room_address"]}:${json["room_port"]}"));
    return Room(
      ipAddress: json["room_address"],
      port: json["room_port"],
      channel: channel,
    );
  }
}

Future<Room> fetchRoom() async {
  final response = await http.get(Uri.parse(matchmakerEndpoint));

  if (response.statusCode == 200) {
    return Room.fromJson(jsonDecode(response.body));
  } else {
    return Future.error("Failed to load room");
  }
}

// For the testing purposes, you should probably use https://pub.dev/packages/uuid
Uuid uuid = const Uuid();
String randomString() {
  final random = Random.secure();
  final values = List<int>.generate(16, (i) => random.nextInt(255));
  return base64UrlEncode(values);
}

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: MyHomePage(),
    );
  }
}

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
  final _user = types.User(id: uuid.v4());

  // Init
  @override
  void initState() {
    super.initState();
    futureRoom = fetchRoom();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
          bottom: false,
          child: FutureBuilder<Room>(
            future: futureRoom,
            builder: (roomContext, roomSnapshot) {
              if (roomSnapshot.hasData) {
                return StreamBuilder(
                  stream: roomSnapshot.data!.channel.stream,
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
                              createdAt: DateTime.now().millisecondsSinceEpoch,
                              id: randomString(),
                              text: data[1],
                            ));
                      }
                    }
                    return Chat(
                      messages: _messages,
                      onSendPressed: (types.PartialText message) {
                        roomSnapshot.data!.channel.sink
                            .add("${_user.id}::${message.text}");
                      },
                      user: _user,
                    );
                  },
                );
              } else if (roomSnapshot.hasError) {
                return Text("${roomSnapshot.error}");
              } else {
                return const CircularProgressIndicator();
              }
            },
          )),
    );
  }
}
