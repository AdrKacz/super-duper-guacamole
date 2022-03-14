import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_chat_ui/flutter_chat_ui.dart';
import 'package:uuid/uuid.dart';

import 'package:web_socket_channel/web_socket_channel.dart';

// Endpoints
const String matchmakerEndpoint = "http://13.37.214.198:8080";

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
  // WebSocket Server
  // TODO: URL in env variable
  final _channel =
      WebSocketChannel.connect(Uri.parse("ws://13.37.214.198:8082"));

  // Messages
  final List<types.Message> _messages = [];
  final _user = types.User(id: uuid.v4());

  // void _addMessage(types.Message message) {
  //   setState(() {
  //     _messages.insert(0, message);
  //   });
  // }

  void _handleSendPressed(types.PartialText message) {
    // Send to server
    print(randomString());
    _channel.sink.add("${_user.id}::${message.text}");
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
          bottom: false,
          child: StreamBuilder(
            stream: _channel.stream,
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
                onSendPressed: _handleSendPressed,
                user: _user,
              );
            },
          )),
    );
  }
}
