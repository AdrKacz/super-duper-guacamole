import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:awachat/user.dart';

class WebSocketConnection {
  static const String _websocketEndpoint =
      "wss://q6gjgdgowf.execute-api.eu-west-3.amazonaws.com/dev";

  late WebSocketChannel _channel;
  Stream<dynamic> get stream => _channel.stream;

  WebSocketConnection() {
    reconnect();
  }

  void register() {
    _channel.sink.add(jsonEncode({"action": "register", "id": User().id}));
  }

  void switchgroup() {
    User().resetGroup();
    _channel.sink.add(jsonEncode(
        {"action": "switchgroup", "groupid": User().groupid, "id": User().id}));
  }

  void textmessage(String encodedMessage) {
    _channel.sink.add(jsonEncode({
      "action": "textmessage",
      "id": User().id,
      "groupid": User().groupid,
      "message": encodedMessage,
    }));
  }

  void banrequest(String userid, String messageid) {
    _channel.sink.add(jsonEncode({
      "action": "banrequest",
      "id": User().id,
      "bannedid": userid,
      "messageid": messageid,
    }));
  }

  void banreply(String banneduserid, String status) {
    _channel.sink.add(jsonEncode({
      "action": "banreply",
      "id": User().id,
      "bannedid": banneduserid,
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
