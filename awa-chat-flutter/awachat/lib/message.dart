import 'package:awachat/user.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'dart:math';
import 'dart:convert';

String randomString() {
  final random = Random.secure();
  final values = List<int>.generate(16, (i) => random.nextInt(255));
  return base64UrlEncode(values);
}

types.Message? messageDecode(String? encodedMessage) {
  if (encodedMessage == null) {
    return null;
  }

  final List<String> data = encodedMessage.split(RegExp(r"::"));

  if (data.length < 4) {
    return null;
  }
  final String author = data[0];
  final String createdAt = data[1];
  final String id = data[2];
  final String text = data.sublist(3).join('::');

  switch (author) {
    case '0':
      print("Decode text from main: $text");
      return null;
    default:
      if (int.tryParse(data[1]) != null) {
        return types.TextMessage(
          author: types.User(id: author),
          createdAt: int.parse(createdAt),
          id: id,
          text: text,
        );
      } else {
        print("Date is not integer: $createdAt");
        return null;
      }
  }
}

String messageEncode(types.PartialText partialText) {
  final String author = User().user.id;
  final int createdAt = DateTime.now().millisecondsSinceEpoch;
  final String id = randomString();
  final String text = partialText.text;

  return "$author::$createdAt::$id::$text";
}
