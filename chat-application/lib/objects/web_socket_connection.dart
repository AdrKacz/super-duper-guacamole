import 'dart:convert';

import 'package:awachat/widgets/questions.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:awachat/objects/user.dart';

class WebSocketConnection {
  static const String _websocketEndpoint =
      String.fromEnvironment("WEBSOCKET_ENDPOINT");

  late WebSocketChannel _channel;
  Stream<dynamic> get stream => _channel.stream;

  WebSocketConnection() {
    reconnect();
  }

  void register() {
    print('register');
    _channel.sink.add(jsonEncode({"action": "register", "id": User().id}));
  }

  void unregister() {
    print('unregister');
    _channel.sink.add(jsonEncode({"action": "unregister", "id": User().id}));
  }

  void switchgroup() {
    print('switchgroup');
    _channel.sink.add(jsonEncode({
      "action": "switchgroup",
      "groupid": User().groupId,
      "id": User().id,
      "questions": loadSelectedAnswers()
    }));
  }

  void textmessage(String encodedMessage) {
    print('textmessage');
    _channel.sink.add(jsonEncode({
      "action": "textmessage",
      "id": User().id,
      "groupid": User().groupId,
      "message": encodedMessage,
    }));
  }

  void banrequest(String userid, String messageid) {
    print('banrequest');
    _channel.sink.add(jsonEncode({
      "action": "banrequest",
      "id": User().id,
      "groupid": User().groupId,
      "bannedid": userid,
      "messageid": messageid,
    }));
  }

  void banreply(String banneduserid, String status) {
    print('banreply');
    _channel.sink.add(jsonEncode({
      "action": "banreply",
      "id": User().id,
      "groupid": User().groupId,
      "bannedid": banneduserid,
      "status": status,
    }));
  }

  void reconnect() {
    print('reconnect');
    _channel = WebSocketChannel.connect(Uri.parse(_websocketEndpoint));
  }

  void close() {
    print('Close web socket');
    _channel.sink.close();
  }
}
