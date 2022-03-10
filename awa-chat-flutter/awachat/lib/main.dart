import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_chat_ui/flutter_chat_ui.dart';

import 'package:web_socket_channel/web_socket_channel.dart';

// For the testing purposes, you should probably use https://pub.dev/packages/uuid
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
  final _channel = WebSocketChannel.connect(Uri.parse("ws://172.20.10.2:8765"));

  // Messages
  final List<types.Message> _messages = [];
  final _user = const types.User(id: '06c33e8b-e835-4736-80f4-63f44b66666c');

  void _addMessage(types.Message message) {
    setState(() {
      _messages.insert(0, message);
    });
  }

  void _handleSendPressed(types.PartialText message) {
    final textMessage = types.TextMessage(
      author: _user,
      createdAt: DateTime.now().millisecondsSinceEpoch,
      id: randomString(),
      text: message.text,
    );

    // Send to server
    _channel.sink.add(message.text);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
          bottom: false,
          child: StreamBuilder(
            stream: _channel.stream,
            builder: (context, snapshot) {
              print(snapshot.hasData);
              print(snapshot.data);
              _messages.insert(
                  0,
                  types.TextMessage(
                    author: _user,
                    createdAt: DateTime.now().millisecondsSinceEpoch,
                    id: randomString(),
                    text: "From Server",
                  ));
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
