import 'package:awachat/memory.dart';
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
          author: types.User(
              id: author,
              imageUrl:
                  "https://avatars.dicebear.com/api/croodles-neutral/$author.png"),
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

Future<String?> reportActionOnMessage(BuildContext context) async {
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
              onPressed: () async {
                String? hasSeenDeleteInformation =
                    Memory().get('user', 'hasSeenDeleteInformation');
                if (hasSeenDeleteInformation == null ||
                    hasSeenDeleteInformation == "false") {
                  switch (await showDialog(
                      context: context,
                      builder: (BuildContext context) {
                        return AlertDialog(
                            title: const Text("Attention"),
                            content: const SingleChildScrollView(
                              child: Text(
                                  'Le message ne sera supprimé que chez toi. Les autres personnes du groupe pourront toujours le voir.'),
                            ),
                            actions: [
                              TextButton(
                                child: const Text('Ne pas supprimer'),
                                onPressed: () {
                                  Navigator.pop(context, "nothing");
                                },
                              ),
                              TextButton(
                                child: const Text('Ok'),
                                onPressed: () {
                                  Navigator.pop(context, "confirmed");
                                },
                              )
                            ]);
                      })) {
                    case 'confirmed':
                      Memory().put('user', 'hasSeenDeleteInformation', 'true');
                      Navigator.pop(context, "delete");
                      break;
                    default:
                      Navigator.pop(context, "nothing");
                  }
                } else {
                  Navigator.pop(context, "delete");
                }
              },
              child: const Text("Supprimer le message"),
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

Future<String?> banActionOnMessage(
    BuildContext context, types.Message message) async {
  return await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text(
              'Souhaites-tu bannir du groupe la personne qui a écrit ce message ?'),
          content: SingleChildScrollView(
            child: Text(message.toJson()['text'], textAlign: TextAlign.center),
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('Non'),
              onPressed: () {
                Navigator.pop(context, "denied");
              },
            ),
            TextButton(
              child: const Text('Oui'),
              onPressed: () {
                Navigator.pop(context, "confirmed");
              },
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
