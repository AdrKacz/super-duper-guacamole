import 'package:flutter/material.dart';

import 'package:awachat/pages/agreements/slide.dart';

class AgreementPage extends StatefulWidget {
  const AgreementPage({Key? key, required this.signAgreements})
      : super(key: key);

  final VoidCallback? signAgreements;

  @override
  _AgreementPageState createState() => _AgreementPageState();
}

class _AgreementPageState extends State<AgreementPage> {
  // Agreements
  bool hasSignedRGPD = false;
  bool hasSignedEULA = false;

  void checkAgreements(BuildContext context) {
    if (hasSignedRGPD && hasSignedEULA) {
      print("[MyAppPresentation] You're all good!");
      widget.signAgreements!();
    } else if (!hasSignedRGPD) {
      print("[MyAppPresentation] You didn't sign RGPD");
      showDialog(
          context: context,
          builder: (BuildContext context) {
            return AlertDialog(
              title: const Text(
                "Je ne peux pas continuer sans toi 😖",
                textAlign: TextAlign.center,
              ),
              content: const Text(
                  "Clique sur \"J'ai compris 👍\" et \"Je m'engage 😎\"",
                  textAlign: TextAlign.center),
              actions: [
                TextButton(
                    style: ElevatedButton.styleFrom(
                      onPrimary: const Color(0xff6f61e8),
                    ),
                    onPressed: () {
                      Navigator.of(context).pop();
                    },
                    child: const Text("J'ai compris"))
              ],
            );
          });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        body: SafeArea(
            child: DefaultTabController(
      length: 5,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Expanded(
            child: TabBarView(children: <Widget>[
              const Slide(text: """
Je suis Awa.
Je vais te présenter l'application.
"""),
              const Slide(
                  text:
                      "Chaque personne est placée dans une conversation avec quatres autres personnes."),
              const Slide(text: """
Tu ne t'occupes de rien !
C'est moi qui te place en fonction de tes préférences.
"""),
              RGPDSlide(sign: () {
                setState(() {
                  hasSignedRGPD = true;
                });
                checkAgreements(context);
              }),
              EULASlide(sign: () {
                setState(() {
                  hasSignedEULA = true;
                });
                checkAgreements(context);
              }),
            ]),
          ),
          const TabPageSelector(
              color: Color(0xfff5f5f7), selectedColor: Color(0xff6f61e8)),
        ],
      ),
    )));
  }
}
