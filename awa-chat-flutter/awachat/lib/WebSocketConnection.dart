import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'package:awachat/memory.dart';
import 'package:awachat/user.dart';

class WebSocketConnection {
  static const String _websocketEndpoint =
      "wss://hvxryd7s69.execute-api.eu-west-3.amazonaws.com/dev";

  late WebSocketChannel _channel;
  Stream<dynamic> get stream => _channel.stream;

  WebSocketConnection() {
    reconnect();
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
      User().groupid = "";
    }
    _channel.sink
        .add(jsonEncode({"action": "switchgroup", "userid": User().user.id}));
  }

  void sendmessage(String encodedMessage) {
    _channel.sink.add(jsonEncode({
      "action": "sendmessage",
      "userid": User().user.id,
      "groupid": User().groupid,
      "data": encodedMessage,
    }));
  }

  void banrequest(String userid, String messageid) {
    _channel.sink.add(jsonEncode({
      "action": "banrequest",
      "banneduserid": userid,
      "groupid": User().groupid,
      "messageid": messageid,
    }));
  }

  void banreply(String banneduserid, String status) {
    _channel.sink.add(jsonEncode({
      "action": "banreply",
      "userid": User().user.id,
      "banneduserid": banneduserid,
      "groupid": User().groupid,
      "status": status,
    }));
  }

  void reconnect() {
    _channel = WebSocketChannel.connect(Uri.parse(_websocketEndpoint));
  }

  void close() {
    print('Close web socket');
    _channel.sink.close();
  }
}
