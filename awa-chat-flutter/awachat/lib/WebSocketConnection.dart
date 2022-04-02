import 'dart:convert';
import 'package:awachat/memory.dart';
import 'package:awachat/message.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/user.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class WebSocketConnection {
  static const String _websocketEndpoint =
      "wss://tzs5ejg45b.execute-api.eu-west-3.amazonaws.com/development";

  late final WebSocketChannel _channel;
  Stream<dynamic> get stream => _channel.stream;

  WebSocketConnection() {
    _channel = WebSocketChannel.connect(Uri.parse(_websocketEndpoint));
  }

  void register() {
    _channel.sink
        .add(jsonEncode({"action": "register", "userid": User().user.id}));
  }

  void switchgroup() {
    if (User().groupid != "") {
      FirebaseMessaging.instance
          .unsubscribeFromTopic('group-${User().groupid}');
      Memory().lazyBoxMessages.clear();
      Memory().put('user', 'lastmessage', '0');
    }
    _channel.sink
        .add(jsonEncode({"action": "switchgroup", "userid": User().user.id}));
  }

  void sendmessage(types.PartialText message) {
    _channel.sink.add(jsonEncode({
      "action": "sendmessage",
      "userid": User().user.id,
      "groupid": User().groupid,
      "data": messageEncode(message),
    }));
  }

  void close() {
    print('Close web socket');
    _channel.sink.close();
  }
}
