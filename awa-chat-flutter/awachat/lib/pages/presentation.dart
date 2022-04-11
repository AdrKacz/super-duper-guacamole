import 'package:flutter/material.dart';

import 'package:awachat/pages/slide.dart';

class PresentationPage extends StatelessWidget {
  const PresentationPage({Key? key, required this.setAppState})
      : super(key: key);

  final Function setAppState;

  @override
  Widget build(BuildContext context) {
    final slides = <Widget>[
      const Slide(
        text: """
Je suis Awa.
Je vais te présenter l'application.
""",
        assetPath: 'assets/images/undraw_handcrafts_woman.png',
      ),
      const Slide(
          text:
              "Chaque personne est placée dans une conversation avec quatres autres personnes.",
          assetPath: 'assets/images/undraw_handcrafts_say_hello.png'),
      SlideWithButton(
          text: """
Tu ne t'occupes de rien !
C'est moi qui te place en fonction de tes préférences.
""",
          assetPath: 'assets/images/undraw_handcrafts_planet.png',
          buttonText: "J'ai tout compris 👍",
          onPressed: () {
            setAppState('agreements');
          }),
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
