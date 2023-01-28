import 'package:flutter/material.dart';

void showConfirmDialog(BuildContext context) async {
  return await showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
            title: const Text(
                'Ton changement sera pris en compte pour ton prochain groupe.'),
            actions: <Widget>[
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                },
                child: const Text('Ok'),
              ),
            ]);
      });
}

ButtonStyle getButtonStyle(BuildContext context, bool isActive) {
  if (isActive) {
    return ElevatedButton.styleFrom(
      minimumSize: const Size.fromHeight(100),
      backgroundColor: Theme.of(context).colorScheme.onSecondary,
      foregroundColor: Theme.of(context).colorScheme.onBackground,
    );
  } else {
    return ElevatedButton.styleFrom(
      minimumSize: const Size.fromHeight(100),
      backgroundColor: Theme.of(context).colorScheme.background,
      foregroundColor: Theme.of(context).colorScheme.onBackground,
    );
  }
}
