import 'package:flutter/material.dart';

class ErrorPage extends StatelessWidget {
  const ErrorPage({Key? key, required this.refresh}) : super(key: key);

  final VoidCallback refresh;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
        child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Center(
                child: SingleChildScrollView(
                    child: Column(children: <Widget>[
              Image.asset('assets/images/error.gif'),
              const SizedBox(height: 12),
              const Text(
                  '''Impossible de se connecter, si le problème persiste ferme et rouvre l'application''',
                  textAlign: TextAlign.center),
              const Divider(height: 48),
              IconButton(onPressed: refresh, icon: const Icon(Icons.refresh))
            ])))));
  }
}
