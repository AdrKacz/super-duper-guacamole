import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';

class NameField extends StatelessWidget {
  const NameField({Key? key, this.initialValue}) : super(key: key);

  final String? initialValue;

  void _onSaved(String? name) {
    print('===== ===== Try to save name <$name>');
    if (name is! String) {
      return;
    }
    User().updateGroupUserArguments(User().id!, {'name': name});
    print('Has updated name');
    print(Memory().boxGroupUsers.values);
  }

  @override
  Widget build(BuildContext context) => (TextFormField(
        initialValue: initialValue,
        onSaved: _onSaved,
        validator: (value) {
          if (value == null || value.isEmpty || value.length < 3) {
            return 'Ton prénom doit faire au moins trois lettres.';
          }
          return null;
        },
        autovalidateMode: AutovalidateMode.always,
        decoration: const InputDecoration(
            labelStyle: TextStyle(color: Colors.grey),
            errorStyle: TextStyle(color: Colors.red),
            errorBorder:
                UnderlineInputBorder(borderSide: BorderSide(color: Colors.red)),
            focusedErrorBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: Colors.grey)),
            focusedBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: Colors.grey)),
            border: UnderlineInputBorder(
                borderSide: BorderSide(color: Colors.grey)),
            labelText: 'Prénom'),
      ));
}
