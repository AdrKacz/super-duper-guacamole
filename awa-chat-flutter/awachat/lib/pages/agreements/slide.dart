import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class SlideContainer extends StatelessWidget {
  const SlideContainer({Key? key, required this.child}) : super(key: key);

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Center(
        child: child,
      ),
    );
  }
}

class Slide extends StatelessWidget {
  const Slide({Key? key, required this.text}) : super(key: key);

  final String text;
  @override
  Widget build(BuildContext context) {
    return SlideContainer(
      child: Text(
        text,
        textAlign: TextAlign.center,
      ),
    );
  }
}

class SlideWithButton extends StatelessWidget {
  const SlideWithButton(
      {Key? key,
      required this.text,
      required this.buttonText,
      required this.onPressed})
      : super(key: key);

  final String text;
  final String buttonText;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(text, textAlign: TextAlign.center),
        ElevatedButton(
            onPressed: onPressed,
            child: Text(buttonText),
            style: ElevatedButton.styleFrom(
              primary: const Color(0xff6f61e8),
            ))
      ],
    ));
  }
}

class RGPDSlide extends StatelessWidget {
  const RGPDSlide({Key? key, required this.onPressed}) : super(key: key);

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: ListView(
      shrinkWrap: true,
      children: [
        const Text("""
Je m'engage à ne pas conserver tes données personnelles.
  🔐 Les messages s'enregistrent uniquement sur ton téléphone,
  🔐 Quand tu changes de conversation, tout est supprimé,
  🔐 Tu n'as pas de profil, tu peux changer d'identité à tout moment.
""", textAlign: TextAlign.center),
        ElevatedButton(
            style: ElevatedButton.styleFrom(
              primary: const Color(0xff6f61e8),
            ),
            onPressed: onPressed,
            child: const Text("J'ai compris 👍")),
        const Divider(
          height: 32,
          thickness: 1,
        ),
        const Text("""
Tu te demandes comment je te trouve une conversation engagente et amusante sans ne rien savoir sur toi ? 
Viens voir comment je fonctionne et pose moi des questions 🌍
""", textAlign: TextAlign.center),
        ElevatedButton(
            style: ElevatedButton.styleFrom(
              primary: const Color(0xff6f61e8),
            ),
            onPressed: () async {
              const String url =
                  "https://purring-shark-0e9.notion.site/Awa-048af14525474c29828c867d0ba553a6";
              if (!await launch(url)) {
                throw "Could not launch $url";
              }
            },
            child: const Text("Comment je fonctionne ? 🧠")),
      ],
    ));
  }
}

class EULASlide extends StatelessWidget {
  const EULASlide({Key? key, required this.onPressed}) : super(key: key);

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: Center(
            child: ListView(
      shrinkWrap: true,
      children: [
        const Text("""
Je ne peux respecter mes engagements que si tu restes respecteux et tolérant envers les autres.

Tu dois t'engager à :
  ✅ ne pas envoyer de message insultant ou intimidant,
  ✅ ne pas proposer de service sexuel tarifé,
  ✅ respecter chaque personnes, quelque soit vos divergences,
  ✅ ne pas organiser d'acte criminel.

Tu t'engages à bien respecter cela ?
""", textAlign: TextAlign.center),
        ElevatedButton(
            style: ElevatedButton.styleFrom(
              primary: const Color(0xff6f61e8),
            ),
            onPressed: onPressed,
            child: const Text("Je m'engage 😎"))
      ],
    )));
  }
}
