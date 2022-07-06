import 'dart:convert';
import 'dart:typed_data';

import 'package:awachat/store/memory.dart';
import 'package:awachat/pointycastle/helpers.dart';
import 'package:awachat/widgets/questions.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:awachat/store/user.dart';

class WebSocketConnection {
  static const String _websocketEndpoint =
      String.fromEnvironment("WEBSOCKET_ENDPOINT");

  late WebSocketChannel _channel;
  Stream<dynamic> get stream => _channel.stream;

  WebSocketConnection() {
    print('Init WebSocket');
    reconnect();
  }

  void register() {
    print('Send action register');
    int timestamp = DateTime.now().millisecondsSinceEpoch;
    Uint8List signature = rsaSign(User().pair.privateKey,
        Uint8List.fromList((User().id + timestamp.toString()).codeUnits));
    _channel.sink.add(jsonEncode({
      'action': 'register',
      'id': User().id,
      'signature': signature,
      'timestamp': timestamp,
      'publicKey': encodePublicKeyToPem(User().pair.publicKey)
    }));
  }

  void switchgroup() {
    print('Send action switchgroup');
    _channel.sink.add(jsonEncode({
      "action": "switchgroup",
      "questions": loadSelectedAnswers(),
      "blockedUsers": Memory().getBlockedUsers()
    }));
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
    print('Reconnect WebSocket');
    _channel = WebSocketChannel.connect(Uri.parse(_websocketEndpoint));
  }

  void close() {
    print('Close WebSocket');
    _channel.sink.close();
  }
}
