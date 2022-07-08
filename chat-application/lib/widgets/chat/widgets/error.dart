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
                Image.asset('assets/images/error-lost-in-space.gif'),
                const SizedBox(
                  height: 24,
                ),
                const Text("Oups ! Il y a quelque chose d'anormal.",
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
