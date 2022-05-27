import 'package:awachat/objects/memory.dart';
import 'package:awachat/objects/user.dart';
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
              imageUrl: "https://avatars.dicebear.com/api/bottts/$author.png"),
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
  final String author = User().id;
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
                alertInfo(context,
                    argString: 'hasSeenBanInformation',
                    popAction: 'ban',
                    info: const Text("""Tu vas lancer un vote.

Toutes les personnes présentes, sauf la personne ciblée, pourront accepter ou refuser ta proposition.

Si tu reçois suffisament d'acceptation, la personne ciblée sera envoyée dans un autre groupe."""),
                    acceptString: "Ok",
                    refuseString: "Ne pas bannir");
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
                alertInfo(context,
                    argString: 'hasSeenDeleteInformation',
                    popAction: 'delete',
                    info: const Text(
                        'Le message ne sera supprimé que chez toi. Les autres personnes du groupe pourront toujours le voir.'),
                    acceptString: "Ok",
                    refuseString: "Ne pas supprimer");
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
  if (message.type != types.MessageType.text) {
    // TODO: can't handle none text messages
    return null;
  }

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
  if (message.type != types.MessageType.text) {
    // TODO: can't handle none text messages
    return;
  }

  final String mailto = Uri(
    scheme: 'mailto',
    path: 'thunder_parsons.09@icloud.com',
    queryParameters: {
      'subject': 'Signalement',
      'body': """--- --- ---
            Ajoute tes remarques ici.
            --- --- ---
            
            L'utilisateur 
            ${User().id}
            signale le comportement de 
            ${message.author.id}
            Le message signalé est :
            --- --- ---
            ${message.toJson()["text"]}
            --- --- ---
            
            Contexte (dix derniers messages) :
            ${messages.sublist(max(messages.length - 10, 0)).where((types.Message e) => e.type == types.MessageType.text).map((types.Message e) => """(${e.author.id}) ${e.toJson()["text"]}
            ---
            """).join("""
""")}""",
    },
  ).toString().replaceAll("+", "%20");
  if (!await launch(mailto)) {
    throw "Could not launch $mailto";
  }
}

// === === ===
// Show Alert first seen

void alertInfo(BuildContext context,
    {required String argString,
    required Widget info,
    String popAction = "confirmed",
    String defaultAction = "nothing",
    String acceptString = "accept",
    String refuseString = "refuse"}) async {
  String? arg = Memory().get('user', argString);
  if (arg == null || arg == "false") {
    switch (await showDialog(
        context: context,
        builder: (BuildContext context) {
          return AlertDialog(
              title: const Text("Attention"),
              content: SingleChildScrollView(
                child: info,
              ),
              actions: [
                TextButton(
                  child: Text(refuseString),
                  onPressed: () {
                    Navigator.pop(context, "nothing");
                  },
                ),
                TextButton(
                  child: Text(acceptString),
                  onPressed: () {
                    Navigator.pop(context, "confirmed");
                  },
                )
              ]);
        })) {
      case 'confirmed':
        Memory().put('user', argString, 'true');
        Navigator.pop(context, popAction);
        break;
      default:
        Navigator.pop(context, defaultAction);
    }
  } else {
    Navigator.pop(context, popAction);
  }
}
