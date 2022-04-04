import 'package:flutter/material.dart';

// NOTE: unused
class ErrorPage extends StatelessWidget {
  const ErrorPage({Key? key, required this.onPressed}) : super(key: key);

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Center(
        child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
          const Text("Je n'ai pas pu te trouver une conversation"),
          ElevatedButton(
              style: ElevatedButton.styleFrom(
                primary: const Color(0xff6f61e8),
              ),
              onPressed: onPressed,
              child: const Text("Réessayer"))
        ]));
  }
}
