import 'package:awachat/memory.dart';
import 'package:flutter/material.dart';

import 'package:awachat/pages/slide.dart';

class AgreementsPage extends StatelessWidget {
  const AgreementsPage({Key? key, required this.setAppState}) : super(key: key);

  final Function setAppState;

  @override
  Widget build(BuildContext context) {
    return SecondPage(
      onPressed: () {
        Navigator.push(
          context,
          MaterialPageRoute(
              builder: (context) => ThirdPage(onPressed: () {
                    Memory().put('user', 'hasSignedAgreements', "true");
                    Navigator.popUntil(context, ModalRoute.withName('/'));
                    setAppState('main');
                  })),
        );
      },
    );
  }
}

class SecondPage extends StatelessWidget {
  const SecondPage({Key? key, required this.onPressed}) : super(key: key);

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        body: SafeArea(
            child: RGPDSlide(
      onPressed: onPressed,
    )));
  }
}

class ThirdPage extends StatelessWidget {
  const ThirdPage({Key? key, required this.onPressed}) : super(key: key);

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        body: SafeArea(
            child: EULASlide(
      onPressed: onPressed,
    )));
  }
}
