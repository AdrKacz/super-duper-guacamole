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
    print('Send action register');
    _channel.sink.add(jsonEncode({"action": "register", "id": User().id}));
  }

  void switchgroup() {
    print('Send action switchgroup');
    _channel.sink.add(jsonEncode(
        {"action": "switchgroup", "questions": loadSelectedAnswers()}));
  }

  void textmessage(String encodedMessage) {
    print('Send action textmessage');
    _channel.sink.add(jsonEncode({
      "action": "textmessage",
      "message": encodedMessage,
    }));
  }

  void banrequest(String userid, String messageid) {
    print('Send action banrequest');
    _channel.sink.add(jsonEncode({
      "action": "banrequest",
      "bannedid": userid,
      "messageid": messageid,
    }));
  }

  void banreply(String banneduserid, String status) {
    print('Send action banreply');
    _channel.sink.add(jsonEncode({
      "action": "banreply",
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
