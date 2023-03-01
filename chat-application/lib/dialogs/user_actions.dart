import 'dart:io';

import 'package:awachat/dialogs/helpers.dart';
import 'package:awachat/network/http_connection.dart';
import 'package:awachat/store/group_user.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';
import 'package:flutter_email_sender/flutter_email_sender.dart';
import 'package:path_provider/path_provider.dart';

SimpleDialogOption dialogUserReportOption(
        BuildContext context, String userId) =>
    SimpleDialogOption(
        child: const Text('''Signaler l'utilisateur'''),
        onPressed: () => dialogAction(context,
                content:
                    '''Tu vas nous envoyer un e-mail avec l'identité de cet utilisateur. Nous te contacterons pour t'informer des mesures prises.''',
                action: () async {
              await _sendReportMail(userId);
            }));

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
              await HttpConnection()
                  .put(path: 'request-ban', body: {'bannedid': userId});
            }));

void dialogUserActions(BuildContext context, String userId) => (showDialog(
    context: context,
    builder: (BuildContext context) => (SimpleDialog(children: <Widget>[
          dialogUserBlockOption(context, userId),
          dialogUserBanOption(context, userId),
          dialogUserReportOption(context, userId),
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

Future<void> _sendReportMail(String userId) async {
  GroupUser groupUser = GroupUser(userId);

  // get photo
  File? file = await _getFile(groupUser.getArgument('imageRelativePath'));

  final String body = '''
  --- --- ---
  Ajoute tes remarques ici.
  --- --- ---

  L'utilisateur
  ${User().id}
  signale l'identité de l'utilisateur
  ${groupUser.id}

  Le nom de l'utilisateur signalé est :
  --- --- ---
  ${groupUser.getArgument('name') ?? 'Impossible de récupérer le nom de cet utilisateur.'}
  --- --- ---

  ${file is File ? 'La photo de profil de cet utilisateur est en pièce jointe.' : 'Impossible de récupérer la photo de l\'utilisateur signalé.'}
''';

  final Email email = Email(
      body: body,
      subject: 'Signalement',
      recipients: ['awachat.app@gmail.com'],
      attachmentPaths: file is File ? [file.path] : null);

  try {
    await FlutterEmailSender.send(email);
  } catch (e) {
    print('Cannot send email: $e');
  }
}

Future<File?> _getFile(String? relativePath) async {
  if (relativePath == null) {
    return null;
  }

  final String directoryPath = (await getApplicationDocumentsDirectory()).path;

  final String path = '$directoryPath$relativePath';

  final File file = File(path);

  try {
    await file.length();
    return file;
  } catch (e) {
    return null;
  }
}
