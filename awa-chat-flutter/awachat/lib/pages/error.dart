import 'package:flutter/material.dart';

// NOTE: unused
class ErrorPage extends StatelessWidget {
  const ErrorPage({Key? key, required this.refresh}) : super(key: key);

  final VoidCallback refresh;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: SingleChildScrollView(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Image.asset('assets/images/undraw_warning_cyit.png'),
              const Divider(height: 48),
              const Text("Oups ! Il y a quelque chose d'anormal."),
              const SizedBox(
                height: 24,
              ),
              IconButton(
                  onPressed: refresh,
                  icon: const Icon(
                    Icons.refresh,
                    color: Color(0xff6f61e8),
                  )),
            ],
          ),
        ),
      ),
    );
  }
}
