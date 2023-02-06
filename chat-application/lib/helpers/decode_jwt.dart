import 'dart:convert';

Map decodeToken(String token) {
  String decodedToken;
  String encodedToken = token.split('.')[1];
  try {
    while (encodedToken.length * 6 % 8 != 0) {
      encodedToken += '=';
    }
    decodedToken = utf8.decode(base64.decode(encodedToken));
  } catch (e) {
    throw 'decode token error: $e';
  }
  return jsonDecode(decodedToken);
}

bool isTokenExpired(String token) {
  try {
    Map jwt = decodeToken(token);
    if (1000 * jwt['exp'] > DateTime.now().millisecondsSinceEpoch) {
      return false;
    }
  } catch (e) {
    print('is token expired error: $e');
  }
  return true;
}
