import 'package:awachat/message.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;

Future<String?> dialogAcknowledgeBan(
    BuildContext context, String status, String banneduserid) async {
  String title = '';
  List<Widget> actions = [
    TextButton(
      child: const Text('Ok'),
      onPressed: () {
        Navigator.of(context).pop();
      },
    ),
  ];

  // TODO: how to display name of ban user? As it will be remove from box because they will leave group

  if (banneduserid == User().id && status == 'confirmed') {
    showDialog(
        context: context,
        builder: (BuildContext context) {
          return AlertDialog(
            title: const Text('''Tu es bani du groupe'''),
            actions: actions,
          );
        });
    return null;
  }

  if (banneduserid == User().id) {
    return null; // no need to alert the user
  }

  switch (status) {
    case 'confirmed':
      title = '''Un utilisateur est bani du groupe''';
      actions.insert(
          0,
          TextButton(
            child: const Text('''Supprimer tous ses messages'''),
            onPressed: () {
              final List<String> messageKeysToDelete = [];
              for (final String k in Memory().boxMessages.keys) {
                final types.TextMessage m =
                    decodeMessage(Memory().boxMessages.get(k)!);
                if (m.author.id == banneduserid) {
                  messageKeysToDelete.add(k);
                }
              }
              Memory().boxMessages.deleteAll(messageKeysToDelete);

              Navigator.of(context).pop();
            },
          ));

      break;
    case 'denied':
      title = '''L'utilisateur n'est pas bani du groupe''';
      break;
    default:
      return null;
  }

  return showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(title),
          actions: actions,
        );
      });
}
