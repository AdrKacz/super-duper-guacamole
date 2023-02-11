import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class Error extends StatelessWidget {
  const Error({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
          child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Center(
            child: SingleChildScrollView(
          child: Column(children: <Widget>[
            Image.asset('assets/images/error.gif'),
            const SizedBox(
              height: 12,
            ),
            const Text(
                '''Impossible de se connecter, si le problème persiste ferme et rouvre l'application''',
                textAlign: TextAlign.center),
            const Divider(height: 48),
            IconButton(
              onPressed: () {
                context.go('/chat');
              },
              icon: const Icon(
                Icons.refresh,
              ),
            )
          ]),
        )),
      )),
    );
  }
}
