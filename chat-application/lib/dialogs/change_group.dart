import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';

Future<bool?> dialogChangeGroup(BuildContext context) => (showDialog<bool>(
    barrierDismissible: true,
    context: context,
    builder: (BuildContext context) {
      final String city = Memory().boxUser.get('group-city')!;
      Widget contentChild =
          const Text('''Tu vas quitter ce groupe et en chercher un nouveau.''');
      if (city != 'Je ne trouve pas ma ville') {
        contentChild = Text(
            '''Tu vas quitter ce groupe et en chercher un nouveau à $city.''');
      }
      return AlertDialog(
          content: SingleChildScrollView(child: contentChild),
          actions: <Widget>[
            TextButton(
                onPressed: () => (Navigator.pop(context, false)),
                child: const Text('Refuser')),
            TextButton(
                onPressed: () => (Navigator.pop(context, true)),
                child: const Text('Accepter'))
          ]);
    }));
