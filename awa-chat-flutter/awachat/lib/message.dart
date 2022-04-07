import 'package:awachat/user.dart';
import 'package:flutter/material.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'dart:math';
import 'dart:convert';

import 'package:url_launcher/url_launcher.dart';

String randomString() {
  final random = Random.secure();
  final values = List<int>.generate(16, (i) => random.nextInt(255));
  return base64UrlEncode(values);
}

types.Message? messageDecode(String? encodedMessage, [types.Status? status]) {
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

  status ??= types.Status.delivered;

  switch (author) {
    case '0':
      print("Decode text from main: $text");
      return null;
    default:
      if (int.tryParse(data[1]) != null) {
        return types.TextMessage(
          status: status,
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

Future<String?> actionOnMessage(BuildContext context) async {
  return await showDialog<String>(
      context: context,
      builder: (BuildContext context) {
        return SimpleDialog(
          title: const Text("Que souhaites-tu faire avec ce message ?"),
          children: <Widget>[
            SimpleDialogOption(
              onPressed: () {
                Navigator.pop(context, "ban");
              },
              child: const Text("Bannir la personne qui l'a écrit"),
            ),
            SimpleDialogOption(
              onPressed: () {
                Navigator.pop(context, "report");
              },
              child: const Text("Signaler le message"),
            ),
            SimpleDialogOption(
              onPressed: () {
                Navigator.pop(context, "nothing");
              },
              child: const Text("Rien"),
            ),
          ],
        );
      });
}

Future<void> mailToReportMessage(
    List<types.Message> messages, types.Message message) async {
  final String mailto = Uri(
    scheme: 'mailto',
    path: 'awa.ma.support@gmail.com',
    queryParameters: {
      'subject': 'Signalement',
      'body': """--- --- ---
            Ajoute tes remarques ici.
            --- --- ---
            
            L'utilisateur ${User().user.id} signale le comportement de ${message.author.id}
            Le message signalé est :
            --- --- ---
            ${message.toJson()}
            --- --- ---
            
            Contexte (dix derniers messages) :
            ${messages.sublist(max(messages.length - 10, 0)).map((e) => """${e.toJson()}
            ---
            """).join("""
""")}""",
    },
  ).toString().replaceAll("+", "%20");
  if (!await launch(mailto)) {
    throw "Could not launch $mailto";
  }
}
