import 'package:flutter/material.dart';

class FakeChat extends StatelessWidget {
  const FakeChat({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: SingleChildScrollView(
            child: Column(
              children: [
                CircularProgressIndicator(
                  color: Theme.of(context).colorScheme.onPrimary,
                ),
                const SizedBox(
                  height: 24,
                ),
                const Text('Continue pour changer de groupe !',
                    textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
