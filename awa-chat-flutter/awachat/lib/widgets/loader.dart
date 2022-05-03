import 'package:flutter/material.dart';

class Loader extends StatelessWidget {
  const Loader({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: CircularProgressIndicator(
          color: Theme.of(context).colorScheme.onPrimary,
        ),
      ),
    );
  }
}
