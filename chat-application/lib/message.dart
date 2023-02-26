import 'package:awachat/store/group_user.dart';
import 'package:awachat/store/user.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'dart:math';
import 'dart:convert';
// ignore: depend_on_referenced_packages

String randomString() {
  final random = Random.secure();
  final values = List<int>.generate(16, (i) => random.nextInt(255));
  return base64UrlEncode(values);
}

types.Status getStatusFromName(String name,
    {required types.Status defaultStatus}) {
  for (final types.Status value in types.Status.values) {
    if (name == value.name) {
      return value;
    }
  }
  return defaultStatus;
}

types.TextMessage decodeMessage(String encodedMessage) {
  try {
    final Map jsonMessage = jsonDecode(encodedMessage);

    if (jsonMessage['author'] is String &&
        jsonMessage['createdAt'] is int &&
        jsonMessage['id'] is String &&
        jsonMessage['text'] is String) {
      return types.TextMessage(
          status: getStatusFromName(jsonMessage['status'],
              defaultStatus: types.Status.delivered),
          author: GroupUser(jsonMessage['author']).flyerUser,
          createdAt: jsonMessage['createdAt'],
          id: jsonMessage['id'],
          text: jsonMessage['text']);
    } else {
      //TODO: handle errors
      throw 'missing value in ($jsonMessage) (expect author, createdAt, id, and text)';
    }
  } on FormatException {
    throw 'cannot decode json';
  }
}

String encodeMessage(
    {required String text,
    required types.Status status,
    String? author,
    int? createdAt,
    String? id}) {
  return jsonEncode({
    'author': author ?? User().id,
    'createdAt': createdAt ?? DateTime.now().millisecondsSinceEpoch,
    'id': id ?? randomString(),
    'text': text,
    'status': status.name
  });
}
