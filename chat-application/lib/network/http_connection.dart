import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:awachat/pointycastle/helpers.dart';
import 'package:awachat/store/memory.dart';
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
    Uint8List signature = rsaSign(
        User().keyPair!.privateKey,
        Uint8List.fromList(
            (User().id!.toString() + timestamp.toString()).codeUnits));

    body['id'] = User().id;
    body['signature'] = signature;
    body['timestamp'] = timestamp;
    body['publicKey'] = encodePublicKeyToPem(User().keyPair!.publicKey);

    return http.put(Uri.parse('$_legacyHttpEndpoint/$path'),
        body: jsonEncode(body));
  }

  Future<bool> signUp() async {
    final http.Response response = await http.put(
        Uri.parse('$_httpEndpoint/sign-up'),
        body: jsonEncode({
          'id': User().id,
          'publicKey': encodePublicKeyToPem(User().keyPair!.publicKey)
        }));
    print('sign up response ${response.statusCode}');
    if (response.statusCode == 200) {
      return true;
    } else {
      return false;
    }
  }

  Future<void> signIn() async {
    int timestamp = DateTime.now().millisecondsSinceEpoch;
    Uint8List signature = rsaSign(
        User().keyPair!.privateKey,
        Uint8List.fromList(
            (User().id!.toString() + timestamp.toString()).codeUnits));

    final http.Response response = await http.put(
        Uri.parse('$_httpEndpoint/sign-in'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode(
            {'id': User().id, 'timestamp': timestamp, 'signature': signature}));

    if (response.statusCode == 200) {
      String jwtToken = jsonDecode(response.body)['jwtToken'];
      print('Received jwtToken $jwtToken');
      Memory().boxUser.put('jwtToken', jwtToken);
    } else {
      print('You can\'t sign in');
    }
  }

  Future<http.Response> get({required String path, int n = 0}) async {
    final http.Response response =
        await http.get(Uri.parse('$_httpEndpoint/$path'), headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization':
          'Bearer ${Memory().boxUser.get('jwtToken', defaultValue: '')}'
    });

    if (response.statusCode == 200 || n >= 3) {
      return response;
    } else {
      await signIn();
      return get(path: path, n: n + 1);
    }
  }

  Future<http.Response> post(
      {required String path, required Map body, int n = 0}) async {
    final http.Response response =
        await http.put(Uri.parse('$_httpEndpoint/$path'),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization':
                  'Bearer ${Memory().boxUser.get('jwtToken', defaultValue: '')}'
            },
            body: jsonEncode(body));

    if (response.statusCode == 200 || n >= 3) {
      return response;
    } else {
      await signIn();
      return post(path: path, body: body, n: n + 1);
    }
  }
}
