import 'package:flutter/material.dart';

// NOTE: unused
class ErrorPage extends StatelessWidget {
  const ErrorPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Center(
        child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
          Image.asset('assets/images/undraw_warning_cyit.png'),
          const Text("Oups ! Il y a quelque chose d'anormal."),
        ]));
  }
}
