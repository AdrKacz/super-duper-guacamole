import 'package:flutter/material.dart';

import 'package:awachat/pages/agreements/slide.dart';

class AgreementPage extends StatelessWidget {
  const AgreementPage({Key? key, required this.signAgreements})
      : super(key: key);

  final VoidCallback signAgreements;

  @override
  Widget build(BuildContext context) {
    return FirstPage(onPressed: () {
      Navigator.push(
        context,
        MaterialPageRoute(
            builder: (context) => SecondPage(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (context) => ThirdPage(onPressed: () {
                                Navigator.popUntil(
                                    context, ModalRoute.withName('/'));
                                signAgreements();
                              })),
                    );
                  },
                )),
      );
    });
  }
}

class FirstPage extends StatelessWidget {
  const FirstPage({Key? key, required this.onPressed}) : super(key: key);

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final slides = <Widget>[
      const Slide(text: """
Je suis Awa.
Je vais te présenter l'application.
"""),
      const Slide(
          text:
              "Chaque personne est placée dans une conversation avec quatres autres personnes."),
      SlideWithButton(
        text: """
Tu ne t'occupes de rien !
C'est moi qui te place en fonction de tes préférences.
""",
        buttonText: "J'ai tout compris 👍",
        onPressed: onPressed,
      )
    ];
    return Scaffold(
        body: SafeArea(
            child: DefaultTabController(
                length: slides.length,
                child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      Expanded(child: TabBarView(children: slides)),
                      const TabPageSelector(
                          color: Color(0xfff5f5f7),
                          selectedColor: Color(0xff6f61e8)),
                    ]))));
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
