import 'dart:convert';
import 'dart:typed_data';

import 'package:awachat/pointycastle/helpers.dart';
import 'package:awachat/store/user.dart';
import 'package:http/http.dart' as http;

class HttpConnection {
  static const String _endpoint = String.fromEnvironment('HTTP_ENDPOINT');

  static final HttpConnection _instance = HttpConnection._internal();

  factory HttpConnection() {
    return _instance;
  }

  HttpConnection._internal();

  Future<http.Response> put(String path, Map body) {
    int timestamp = DateTime.now().millisecondsSinceEpoch;
    Uint8List signature = rsaSign(User().pair.privateKey,
        Uint8List.fromList((User().id + timestamp.toString()).codeUnits));

    body['id'] = User().id;
    body['signature'] = signature;
    body['timestamp'] = timestamp;
    body['publicKey'] = encodePublicKeyToPem(User().pair.publicKey);

    return http.put(Uri.parse(_endpoint + path), body: jsonEncode(body));
  }
}
