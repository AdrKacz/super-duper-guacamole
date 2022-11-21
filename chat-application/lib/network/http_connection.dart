import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:awachat/pointycastle/helpers.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:http/http.dart' as http;

class HttpConnection {
  static const String _httpEndpoint = String.fromEnvironment('HTTP_ENDPOINT');

  static final HttpConnection _instance = HttpConnection._internal();

  factory HttpConnection() {
    return _instance;
  }

  HttpConnection._internal();

  Future<bool> signUp() async {
    final http.Response response = await http.put(
        Uri.parse('$_httpEndpoint/sign-up'),
        body: jsonEncode({
          'id': User().id,
          'publicKey': encodePublicKeyToPem(User().pair.publicKey)
        }));
    print('sign up response ${response.statusCode}');
    if (response.statusCode == 200) {
      return true;
    } else {
      return false;
    }
  }

  Future<void> signIn() async {
    print('you signing in');
    int timestamp = DateTime.now().millisecondsSinceEpoch;
    Uint8List signature = rsaSign(User().pair.privateKey,
        Uint8List.fromList((User().id! + timestamp.toString()).codeUnits));

    final http.Response response = await http.put(
        Uri.parse('$_httpEndpoint/sign-in'),
        headers: {
          HttpHeaders.contentTypeHeader: 'application/json',
        },
        body: jsonEncode(
            {'id': User().id, 'timestamp': timestamp, 'signature': signature}));

    if (response.statusCode == 200) {
      Memory().boxUser.put('jwtToken', jsonDecode(response.body)['jwtToken']);
    } else {
      print('You can\'t sign in');
    }
  }

  Future<Map> get({required String path, int n = 0}) async {
    print('GET /$path');
    try {
      final http.Response response =
          await http.get(Uri.parse('$_httpEndpoint/$path'), headers: {
        HttpHeaders.authorizationHeader:
            'Bearer ${Memory().boxUser.get('jwtToken', defaultValue: '')}'
      });
      if (response.statusCode == 401) {
        throw 'Unauthorized';
      } else {
        print('$path: ${response.body}');
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('$path: $e');
      // Incorrect headers from AWS on 401
      // See https://github.com/dart-lang/sdk/issues/46442
      if (n < 3) {
        print('re-sign');
        await signIn();
        return get(path: path, n: n + 1);
      } else {
        print('return null');
        return {}; // TODO: display error on screen to force re-sign up/in manually
      }
    }
  }

  Future<Map> post({required String path, required Map body, int n = 0}) async {
    print('POST /$path');
    try {
      final http.Response response = await http.post(
          Uri.parse('$_httpEndpoint/$path'),
          body: jsonEncode(body),
          headers: {
            HttpHeaders.contentTypeHeader: 'application/json',
            HttpHeaders.authorizationHeader:
                'Bearer ${Memory().boxUser.get('jwtToken', defaultValue: '')}'
          });
      if (response.statusCode == 401) {
        throw 'Unauthorized';
      } else {
        print('$path: ${response.body}');
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('$path: $e');
      // Incorrect headers from AWS on 401
      // See https://github.com/dart-lang/sdk/issues/46442
      if (n < 3) {
        print('re-sign');
        await signIn();
        return post(path: path, body: body, n: n + 1);
      } else {
        print('return null');
        return {}; // TODO: display error on screen to force re-sign up/in manually
      }
    }
  }

  Future<Map> put({required String path, required Map body, int n = 0}) async {
    print('PUT /$path');
    try {
      final http.Response response = await http.put(
          Uri.parse('$_httpEndpoint/$path'),
          body: jsonEncode(body),
          headers: {
            HttpHeaders.contentTypeHeader: 'application/json',
            HttpHeaders.authorizationHeader:
                'Bearer ${Memory().boxUser.get('jwtToken', defaultValue: '')}'
          });
      if (response.statusCode == 401) {
        throw 'Unauthorized';
      } else {
        print('$path: ${response.body}');
        return jsonDecode(response.body);
      }
    } catch (e) {
      print('$path: $e');
      // Incorrect headers from AWS on 401
      // See https://github.com/dart-lang/sdk/issues/46442
      if (n < 3) {
        print('re-sign');
        await signIn();
        return put(path: path, body: body, n: n + 1);
      } else {
        print('return null');
        return {}; // TODO: display error on screen to force re-sign up/in manually
      }
    }
  }
}
