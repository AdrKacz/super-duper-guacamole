import 'package:flutter/material.dart';

class ErrorPage extends StatelessWidget {
  const ErrorPage({Key? key, required this.refresh}) : super(key: key);

  final VoidCallback refresh;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: SingleChildScrollView(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Image.asset('assets/images/error.gif'),
                const SizedBox(
                  height: 24,
                ),
                const Text("""Oups ! Il y a quelque chose d'anormal.
Tu peux fermer l'application et de la ré-ouvrir. N'oublie pas de vérifier ta connexion internet.""",
                    textAlign: TextAlign.center),
                const SizedBox(
                  height: 24,
                ),
                IconButton(
                  onPressed: refresh,
                  icon: const Icon(
                    Icons.refresh,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
