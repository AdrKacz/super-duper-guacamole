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
    "http://13.37.214.198:8080/room/1"; // TODO: correct user_id

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
    print("Create room with ${json["room_address"]}:${json["room_port"]}");
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

  final body = jsonDecode(response.body);
  if (body["error"] == "") {
    //TODO: use statusCode instead 200 vs 204
    await Future.delayed(const Duration(seconds: 1), () {});
    return Room.fromJson(body);
  } else {
    return Future.error("Failed to load room");
  }
}

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
  // TODO: history is kept between room (problem)
  final List<types.Message> _messages = [];
  final _user = types.User(id: uuid.v4());

  // Init
  @override
  void initState() {
    super.initState();
    futureRoom = fetchRoom();
  }

  //TODO: Change room in AppBar ONLY if already connected
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar:
          AppBar(backgroundColor: const Color(0xff1d1c21), actions: <Widget>[
        PopupMenuButton<int>(onSelected: (int result) {
          setState(() {
            futureRoom = fetchRoom();
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
                  print(
                      "Connected to room ${roomSnapshot.data!.ipAddress}:${roomSnapshot.data!.port}");
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
                          roomSnapshot.data!.channel.sink
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
                                futureRoom = fetchRoom();
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
