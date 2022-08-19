import 'dart:convert';
import 'dart:typed_data';

import 'package:awachat/store/memory.dart';
import 'package:awachat/pointycastle/helpers.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:awachat/store/user.dart';

class WebSocketConnection {
  static const String _websocketEndpoint =
      String.fromEnvironment('WEBSOCKET_ENDPOINT');

  late WebSocketChannel _channel;
  Stream<dynamic> get stream => _channel.stream;

  WebSocketConnection() {
    // init websocket
    reconnect();
  }

  void register() {
    // send action register
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
    // send action switchgroup
    _channel.sink.add(jsonEncode({
      'action': 'switchgroup',
      'questions': Memory().boxAnswers.toMap(),
      'blockedUsers': Memory().getBlockedUsers()
    }));
  }

  void textmessage(String encodedMessage) {
    // send action textmessage
    _channel.sink.add(jsonEncode({
      'action': 'textmessage',
      'message': encodedMessage,
    }));
  }

  void banrequest(String userid, String messageid) {
    // send action banrequest
    _channel.sink.add(jsonEncode({
      'action': 'banrequest',
      'bannedid': userid,
      'messageid': messageid,
    }));
  }

  void banreply(String banneduserid, String status) {
    // send action banreply
    _channel.sink.add(jsonEncode({
      'action': 'banreply',
      'bannedid': banneduserid,
      'status': status,
    }));
  }

  void reconnect() {
    // replace channel with a new connected one
    _channel = WebSocketChannel.connect(Uri.parse(_websocketEndpoint));
  }

  void close() {
    _channel.sink.close();
  }
}
