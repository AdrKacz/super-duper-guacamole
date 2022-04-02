import 'package:awachat/user.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'dart:math';
import 'dart:convert';

String randomString() {
  final random = Random.secure();
  final values = List<int>.generate(16, (i) => random.nextInt(255));
  return base64UrlEncode(values);
}

types.Message? messageDecode(String? text) {
  if (text == null) {
    return null;
  }

  List<String> data = text.split(RegExp(r"::"));
  if (data.length != 2) {
    return null;
  }

  switch (data[0]) {
    case '0':
      print("Decode message from server: ${data[1]}");
      return null;
    case '':
      print("Error in messageDecode, text: $text");
      return null;
    default:
      // TODO: date sould be in the message
      return types.TextMessage(
        author: types.User(id: data[0]),
        createdAt: DateTime.now().millisecondsSinceEpoch,
        id: randomString(),
        text: data[1],
      );
  }
}

String messageEncode(types.PartialText partialText) {
  return "${User().user.id}::${partialText.text}";
}
