import 'package:awachat/dialogs/helpers.dart';
import 'package:awachat/network/http_connection.dart';
import 'package:awachat/store/group_user.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';

SimpleDialogOption dialogUserBlockOption(BuildContext context, String userId) =>
    (SimpleDialogOption(
        child: const Text('''Bloquer l'utilisateur'''),
        onPressed: () => dialogAction(context,
                content:
                    '''Tu ne verras plus jamais avec cette utilisateur et tu vas changer de groupe.''',
                action: () async {
              await Memory().boxBlockedUsers.add(userId);
              await User()
                  .changeGroup(); // need to update state of the chat if any
            }, popReturn: 'block')));

SimpleDialogOption dialogUserBanOption(BuildContext context, String userId) =>
    SimpleDialogOption(
        child: const Text('''Bannir l'utilisateur'''),
        onPressed: () =>
            dialogAction(context, content: '''Tu vas lancer un vote.

Toutes les utilisateurs présents, sauf celui-ci, pourront accepter ou refuser ta proposition.

Si la majorité accepte, cet utilisateur sera envoyé dans un autre groupe.''',
                action: () async {
              await HttpConnection().put(path: 'request-ban', body: {
                'bannedid': userId
              }); // TODO: doesnt pop the context for an unknown reason
            }));

void dialogUserActions(BuildContext context, String userId) => (showDialog(
    context: context,
    builder: (BuildContext context) => (SimpleDialog(children: <Widget>[
          dialogUserBlockOption(context, userId),
          dialogUserBanOption(context, userId),
          SimpleDialogOption(
            child: const Text('Retour'),
            onPressed: () => (Navigator.pop(context)),
          )
        ]))));

void dialogBanUserActions(BuildContext context, String userId) {
  final GroupUser groupUser = GroupUser(userId);
  return dialogAction(context,
      content: 'Souhaites-tu bannir ${groupUser.getArgument('name')} groupe ?',
      action: () async {
    await HttpConnection().put(
        path: 'reply-ban', body: {'bannedid': userId, 'status': 'confirmed'});
  }, negativeAction: () async {
    await HttpConnection()
        .put(path: 'reply-ban', body: {'bannedid': userId, 'status': 'denied'});
  }, dismissible: false, popParent: false);
}
