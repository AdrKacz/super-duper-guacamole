import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_email_sender/flutter_email_sender.dart';
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
          author: types.User(id: jsonMessage['author']),
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

Future<String?> reportActionOnMessage(BuildContext context) async {
  return await showDialog<String>(
      context: context,
      builder: (BuildContext context) {
        return SimpleDialog(
            title: const Text('Que souhaites-tu faire avec ce message ?'),
            children: <Widget>[
              SimpleDialogOption(
                  onPressed: () {
                    alertInfo(context,
                        argString: 'hasSeenBanInformation',
                        popAction: 'ban',
                        info: const Text("""Tu vas lancer un vote.

Toutes les personnes présentes, sauf la personne ciblée, pourront accepter ou refuser ta proposition.

Si tu reçois suffisament d'acceptation, la personne ciblée sera envoyée dans un autre groupe."""),
                        acceptString: 'Ok',
                        refuseString: 'Ne pas bannir');
                  },
                  child: const Text("Bannir la personne qui l'a écrit")),
              SimpleDialogOption(
                  onPressed: () {
                    Navigator.pop(context, 'report');
                  },
                  child: const Text('Signaler le message')),
              SimpleDialogOption(
                  onPressed: () {
                    alertInfo(context,
                        argString: 'hasSeenDeleteInformation',
                        popAction: 'delete',
                        info: const Text(
                            'Le message ne sera supprimé que chez toi. Les autres personnes du groupe pourront toujours le voir.'),
                        acceptString: 'Ok',
                        refuseString: 'Ne pas supprimer');
                  },
                  child: const Text('Supprimer le message')),
              SimpleDialogOption(
                  onPressed: () {
                    alertInfo(context,
                        argString: 'hasSeenBlockInformation',
                        popAction: 'block',
                        info: const Text(
                            'Tu vas changer de groupe. Tu ne seras plus avec cette personne dans tes prochains groupes.'),
                        acceptString: 'Ok',
                        refuseString: 'Ne pas bloquer');
                  },
                  child: const Text("Bloquer la personne qui l'a écrit")),
              SimpleDialogOption(
                  onPressed: () {
                    Navigator.pop(context, 'nothing');
                  },
                  child: const Text('Rien'))
            ]);
      });
}

Future<String?> banActionOnMessage(
    BuildContext context, types.Message message) async {
  if (message.type != types.MessageType.text) {
    // TODO: handle others message type
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
                child: Text(message.toJson()['text'],
                    textAlign: TextAlign.center)),
            actions: <Widget>[
              TextButton(
                  child: const Text('Non'),
                  onPressed: () {
                    Navigator.pop(context, 'denied');
                  }),
              TextButton(
                  child: const Text('Oui'),
                  onPressed: () {
                    Navigator.pop(context, 'confirmed');
                  })
            ]);
      });
}

Future<void> mailToReportTextMessage(types.TextMessage textMessage) async {
  // find index of message
  int i = 0;
  for (final String key in Memory().boxMessages.keys) {
    final int createdAt = int.tryParse(key) ?? 0;
    if (createdAt <= (textMessage.createdAt ?? 0)) {
      break;
    }
    i++;
  }
  final String startKey = Memory().boxMessages.keyAt(max(0, i - 5)) ?? '';
  final String endKey =
      Memory().boxMessages.keyAt(min(i + 5, Memory().boxMessages.length - 1)) ??
          '';

  final List<types.TextMessage> contextMessages = [];
  for (final String jsonMessage in Memory()
      .boxMessages
      .valuesBetween(startKey: startKey, endKey: endKey)) {
    try {
      contextMessages.add(decodeMessage(jsonMessage));
    } catch (e) {
      print('chat page error: $e');
    }
  }

  final String body = """
  --- --- ---
  Ajoute tes remarques ici.
  --- --- ---

  L'utilisateur
  ${User().id}
  signale le comportement de l'utilisateur
  ${textMessage.author.id}

  Le message signalé est :
  --- --- ---
  ${textMessage.text}
  --- --- ---

  Contexte :
  ${contextMessages.reversed.map((types.TextMessage e) => '''
--- --- ---
(${e.author.id})
${e.text}
''').join('')}
""";

  final Email email = Email(
      body: body,
      subject: 'Signalement',
      recipients: ['awachat.app@gmail.com']);

  try {
    await FlutterEmailSender.send(email);
  } catch (e) {
    print('Cannot send email: $e');
  }
}

// === === ===
// Show Alert first seen

void alertInfo(BuildContext context,
    {required String argString,
    required Widget info,
    String popAction = 'confirmed',
    String defaultAction = 'nothing',
    String acceptString = 'accept',
    String refuseString = 'refuse'}) async {
  if (Memory().boxUser.containsKey(argString)) {
    switch (await showDialog(
        context: context,
        builder: (BuildContext context) {
          return AlertDialog(
              title: const Text('Attention'),
              content: SingleChildScrollView(child: info),
              actions: [
                TextButton(
                    child: Text(refuseString),
                    onPressed: () {
                      Navigator.pop(context, 'nothing');
                    }),
                TextButton(
                    child: Text(acceptString),
                    onPressed: () {
                      Navigator.pop(context, 'confirmed');
                    })
              ]);
        })) {
      case 'confirmed':
        Memory()
            .boxUser
            .put(argString, DateTime.now().millisecondsSinceEpoch.toString());
        Navigator.pop(context, popAction);
        break;
      default:
        Navigator.pop(context, defaultAction);
    }
  } else {
    Navigator.pop(context, popAction);
  }
}
