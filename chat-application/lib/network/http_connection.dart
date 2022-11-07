import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:awachat/pointycastle/helpers.dart';
import 'package:awachat/store/user.dart';
import 'package:http/http.dart' as http;

class HttpConnection {
  static const String _httpEndpoint = String.fromEnvironment('HTTP_ENDPOINT');
  static const String _legacyHttpEndpoint =
      String.fromEnvironment('LEGACY_HTTP_ENDPOINT');

  static final HttpConnection _instance = HttpConnection._internal();

  factory HttpConnection() {
    return _instance;
  }

  HttpConnection._internal();

  Future<http.Response> legacyPut(String path, Map body) {
    int timestamp = DateTime.now().millisecondsSinceEpoch;
    Uint8List signature = rsaSign(User().pair.privateKey,
        Uint8List.fromList((User().id + timestamp.toString()).codeUnits));

    body['id'] = User().id;
    body['signature'] = signature;
    body['timestamp'] = timestamp;
    body['publicKey'] = encodePublicKeyToPem(User().pair.publicKey);

    return http.put(Uri.parse('$_legacyHttpEndpoint/$path'),
        body: jsonEncode(body));
  }

  Future<http.Response> signUp() {
    return http.put(Uri.parse('$_httpEndpoint/sign-up'),
        body: jsonEncode({
          'id': User().id,
          'publicKey': encodePublicKeyToPem(User().pair.publicKey)
        }));
  }

  Future<http.Response> signIn() {
    int timestamp = DateTime.now().millisecondsSinceEpoch;
    Uint8List signature = rsaSign(User().pair.privateKey,
        Uint8List.fromList((User().id + timestamp.toString()).codeUnits));

    return http.put(Uri.parse('$_httpEndpoint/sign-in'),
        body: jsonEncode(
            {'id': User().id, 'timestamp': timestamp, 'signature': signature}));
  }

  Future<http.Response> get({required String path, int n = 0}) async {
    http.Response response = await http.get(Uri.parse('$_httpEndpoint/$path'));

    if (response.statusCode == 200 || n >= 3) {
      return response;
    } else {
      await signIn();
      return get(path: path, n: n + 1);
    }
  }

  Future<http.Response> post(
      {required String path, required Map body, int n = 0}) async {
    http.Response response = await http.put(Uri.parse('$_httpEndpoint/$path'),
        body: jsonEncode(body));

    if (response.statusCode == 200 || n >= 3) {
      return response;
    } else {
      await signIn();
      return post(path: path, body: body, n: n + 1);
    }
  }
}
