import 'dart:math';

import 'package:awachat/dialogs/helpers.dart';
import 'package:awachat/dialogs/user_actions.dart';
import 'package:awachat/message.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_email_sender/flutter_email_sender.dart';

SimpleDialogOption dialogMessageDeleteOption(
        BuildContext context, types.Message message) =>
    SimpleDialogOption(
        child: const Text('''Supprimer le message'''),
        onPressed: () => dialogAction(context,
                content:
                    '''Le message ne sera supprimé que chez toi. Les autres personnes du groupe pourront toujours le voir.''',
                action: () async {
              await Memory().boxMessages.delete(message.createdAt.toString());
            }));

SimpleDialogOption dialogMessageReportOption(
        BuildContext context, types.Message message) =>
    SimpleDialogOption(
        child: const Text('''Signaler le message'''),
        onPressed: () => dialogAction(context,
                content:
                    '''Tu vas nous envoyer un e-mail avec un morceau de la conversation. Nous te contacterons pour t'informer des mesures prises.''',
                action: () async {
              await _sendReportMail(
                  types.TextMessage.fromJson(message.toJson()));
            }));

Future<String?> dialogMessageActions(
    BuildContext context, types.Message message) async {
  final String userId = message.author.id;
  return await showDialog<String?>(
      context: context,
      builder: (BuildContext context) {
        return SimpleDialog(children: <Widget>[
          dialogMessageDeleteOption(context, message),
          dialogMessageReportOption(context, message),
          dialogUserBlockOption(context, userId),
          dialogUserBanOption(context, userId),
          SimpleDialogOption(
              onPressed: () {
                Navigator.pop(context);
              },
              child: const Text('Retour'))
        ]);
      });
}

Future<void> _sendReportMail(types.TextMessage message) async {
// find index of message
  int i = 0;
  for (final String key in Memory().boxMessages.keys) {
    final int createdAt = int.tryParse(key) ?? 0;
    if (createdAt <= (message.createdAt ?? 0)) {
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
  ${message.author.id}

  Le message signalé est :
  --- --- ---
  ${message.text}
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
