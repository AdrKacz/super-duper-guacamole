import 'package:flutter/material.dart';

void dialogAction(BuildContext context,
        {required String content,
        required Future<void> Function() action,
        Future<void> Function()? negativeAction,
        bool dismissible = true,
        bool popParent = true,
        String? popReturn}) =>
    _dialogConfirm(context, content: content, dismissible: dismissible)
        .then((bool? value) {
      final confirmed = value is bool && value;
      if (popParent && confirmed) {
        // TODO: use a removeRoute with correct RouteSetting to remove the correct one
        // Or correctly handle the pop up stacks
        // for no one can dismiss another one which create a mess
        Navigator.pop(context, popReturn);
      }
      return confirmed;
    }).then((bool confirmed) async {
      if (confirmed) {
        await action();
        return;
      }

      if (negativeAction is Future<void> Function()) {
        await negativeAction();
      }
    });

Future<bool?> _dialogConfirm(BuildContext context,
        {required String content, required bool dismissible}) =>
    (showDialog<bool>(
        barrierDismissible: dismissible,
        context: context,
        builder: (BuildContext context) => (AlertDialog(
                content: SingleChildScrollView(child: Text(content)),
                actions: <Widget>[
                  TextButton(
                      onPressed: () => (Navigator.pop(context, false)),
                      child: const Text('Refuser')),
                  TextButton(
                      onPressed: () => (Navigator.pop(context, true)),
                      child: const Text('Accepter'))
                ]))));
