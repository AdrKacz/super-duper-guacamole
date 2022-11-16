import 'dart:convert';
import 'dart:typed_data';

import 'package:awachat/pointycastle/helpers.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:awachat/store/user.dart';

class WebSocketConnection {
  static const String _websocketEndpoint =
      String.fromEnvironment('WEBSOCKET_ENDPOINT');

  late WebSocketChannel _channel;
  Stream<dynamic> get stream => _channel.stream;

  WebSocketConnection() {
    connect();
  }

  void _add(dynamic data) {
    try {
      print('send $data');
      _channel.sink.add(data);
    } catch (error) {
      print('error $error');
      close();
    }
  }

  void register() {
    // send action register
    int timestamp = DateTime.now().millisecondsSinceEpoch;
    Uint8List signature = rsaSign(User().pair.privateKey,
        Uint8List.fromList((User().id! + timestamp.toString()).codeUnits));

    _add(jsonEncode({
      'action': 'register',
      'id': User().id,
      'signature': signature,
      'timestamp': timestamp,
      'publicKey': encodePublicKeyToPem(User().pair.publicKey)
    }));
  }

  void banrequest(String userid, String messageid) {
    // send action banrequest
    _add(jsonEncode({
      'action': 'banrequest',
      'bannedid': userid,
      'messageid': messageid,
    }));
  }

  void banreply(String banneduserid, String status) {
    // send action banreply
    _add(jsonEncode({
      'action': 'banreply',
      'bannedid': banneduserid,
      'status': status,
    }));
  }

  void connect() {
    _channel = WebSocketChannel.connect(Uri.parse(_websocketEndpoint));
  }

  void close() {
    _channel.sink.close();
  }
}
