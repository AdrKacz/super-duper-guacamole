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
    print('PUT /sign-up');
    try {
      final http.Response response = await http.put(
          Uri.parse('$_httpEndpoint/sign-up'),
          body: jsonEncode({
            'id': User().id,
            'publicKey': encodePublicKeyToPem(User().pair.publicKey)
          }));
      print('response ${response.statusCode} - ${response.body}');
      if (response.statusCode == 200) {
        return true;
      } else {
        throw 'you can\'t sign up, status code ${response.statusCode}, response ${response.toString()}';
      }
    } catch (e) {
      print('sign-up: $e');
      return false;
    }
  }

  Future<void> signIn() async {
    print('PUT /sign-in');
    try {
      int timestamp = DateTime.now().millisecondsSinceEpoch;
      Uint8List signature = rsaSign(User().pair.privateKey,
          Uint8List.fromList((User().id! + timestamp.toString()).codeUnits));

      final http.Response response = await http.put(
          Uri.parse('$_httpEndpoint/sign-in'),
          headers: {
            HttpHeaders.contentTypeHeader: 'application/json',
          },
          body: jsonEncode({
            'id': User().id,
            'timestamp': timestamp,
            'signature': signature
          }));
      print('response ${response.statusCode} - ${response.body}');
      if (response.statusCode == 200) {
        Memory().boxUser.put('jwt', jsonDecode(response.body)['jwt']);
      } else {
        throw 'you can\'t sign in, status code ${response.statusCode}';
      }
    } catch (e) {
      print('sign-in: $e');
    }
  }

  Future<Map> _request(
      {required Future<http.Response> Function() getResponse,
      required String path,
      int n = 0}) async {
    try {
      final http.Response response = await getResponse();
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
      if (e == 'Unauthorized' && n < 3) {
        print('re-sign');
        await signIn();
        return _request(getResponse: getResponse, path: path, n: n + 1);
      } else {
        print('return null');
        return {}; // TODO: display error on screen to force re-sign up/in manually
      }
    }
  }

  Future<Map> get({required String path}) async {
    print('GET /$path');
    return _request(
        getResponse: () {
          return http.get(Uri.parse('$_httpEndpoint/$path'), headers: {
            HttpHeaders.authorizationHeader:
                'Bearer ${Memory().boxUser.get('jwt', defaultValue: '')}'
          });
        },
        path: path);
  }

  Future<Map> post({required String path, required Map body}) async {
    print('POST /$path, body $body');
    return _request(
        getResponse: () {
          return http.post(Uri.parse('$_httpEndpoint/$path'),
              body: jsonEncode(body),
              headers: {
                HttpHeaders.contentTypeHeader: 'application/json',
                HttpHeaders.authorizationHeader:
                    'Bearer ${Memory().boxUser.get('jwt', defaultValue: '')}'
              });
        },
        path: path);
  }

  Future<Map> put({required String path, required Map body}) async {
    print('PUT /$path, body $body');
    return _request(
        getResponse: () {
          return http.put(Uri.parse('$_httpEndpoint/$path'),
              body: jsonEncode(body),
              headers: {
                HttpHeaders.contentTypeHeader: 'application/json',
                HttpHeaders.authorizationHeader:
                    'Bearer ${Memory().boxUser.get('jwt', defaultValue: '')}'
              });
        },
        path: path);
  }

  Future<Map> delete({required String path, required Map body}) async {
    print('DELETE /$path');
    return _request(
        getResponse: () {
          return http.delete(Uri.parse('$_httpEndpoint/$path'),
              body: jsonEncode(body),
              headers: {
                HttpHeaders.contentTypeHeader: 'application/json',
                HttpHeaders.authorizationHeader:
                    'Bearer ${Memory().boxUser.get('jwt', defaultValue: '')}'
              });
        },
        path: path);
  }
}
