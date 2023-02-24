import 'package:flutter/material.dart';

class NameField extends StatelessWidget {
  const NameField({Key? key}) : super(key: key);
  // TODO: hgandle problem when you type it freezes the photo above
  // TODO: save and send the name along with the photo
  @override
  Widget build(BuildContext context) => (TextFormField(
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
