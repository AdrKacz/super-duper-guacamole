import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:awachat/user.dart';

class WebSocketConnection {
  static const String _websocketEndpoint =
      "wss://g10ttcw68f.execute-api.eu-west-3.amazonaws.com/dev";

  late WebSocketChannel _channel;
  Stream<dynamic> get stream => _channel.stream;

  WebSocketConnection() {
    reconnect();
  }

  void register() {
    _channel.sink.add(jsonEncode({"action": "register", "userid": User().id}));
  }

  void switchgroup() {
    User().resetGroup();
    _channel.sink
        .add(jsonEncode({"action": "switchgroup", "userid": User().id}));
  }

  void sendmessage(String encodedMessage) {
    _channel.sink.add(jsonEncode({
      "action": "sendmessage",
      "userid": User().id,
      "groupid": User().groupid,
      "data": encodedMessage,
    }));
  }

  void banrequest(String userid, String messageid) {
    _channel.sink.add(jsonEncode({
      "action": "banrequest",
      "userid": User().id,
      "banneduserid": userid,
      "groupid": User().groupid,
      "messageid": messageid,
    }));
  }

  void banreply(String banneduserid, String status) {
    _channel.sink.add(jsonEncode({
      "action": "banreply",
      "userid": User().id,
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
