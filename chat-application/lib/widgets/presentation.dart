import 'package:flutter/material.dart';

class Presentation extends StatelessWidget {
  const Presentation({Key? key, required this.nextAppStatus}) : super(key: key);

  final Function nextAppStatus;

  @override
  Widget build(BuildContext context) {
    final slides = <Widget>[
      const Slide(
        text: """Salut, je suis Awa.
        
Je vais te présenter l'application.""",
        assetPath: 'assets/images/onboard-page-1.gif',
      ),
      const Slide(
          text: """Je vais te faire entrer dans un groupe de conversation.

Tu y seras totalement anonyme, tu n'as pas besoin de créer un profil.""",
          assetPath: 'assets/images/onboard-page-2.gif'),
      CustomSlide(
          assetPath: 'assets/images/onboard-page-3.gif',
          child: Text.rich(
            TextSpan(
              children: [
                const TextSpan(
                    text: '''Tu ne seras que dans un groupe à la fois.
          
'''),
                TextSpan(
                    text: 'Swipe',
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.onPrimary,
                        fontWeight: FontWeight.bold)),
                const TextSpan(text: ' vers la gauche ou touche la '),
                const WidgetSpan(child: Icon(Icons.door_front_door_outlined)),
                const TextSpan(
                    text:
                        ' en haut à droite de ton écran pour partir explorer un autre groupe.')
              ],
            ),
            textAlign: TextAlign.center,
          )),
      const Slide(
          text: """Si un message t'offense, reste appuyé dessus.

Tu pourras le supprimer, me le signaler, ou bien expulser du groupe la personne qui l'a écrit.""",
          assetPath: 'assets/images/onboard-page-4.gif'),
      SlideWithButton(
        text: 'Hâte de te faire de nouveaux potes ?',
        assetPath: 'assets/images/onboard-page-5.gif',
        buttonText: "C'est parti !",
        onPressed: () {
          nextAppStatus();
        },
      ),
    ];
    return Scaffold(
      body: SafeArea(
        child: DefaultTabController(
          length: slides.length,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Expanded(child: TabBarView(children: slides)),
              TabPageSelector(
                color: Theme.of(context).colorScheme.primary,
                selectedColor: Theme.of(context).colorScheme.onPrimary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ===== ===== =====
// ===== ===== =====
// HELPERS

class SlideContainer extends StatelessWidget {
  const SlideContainer({Key? key, required this.child}) : super(key: key);

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Center(
        child: SingleChildScrollView(child: child),
      ),
    );
  }
}

class Slide extends StatelessWidget {
  const Slide({Key? key, required this.text, required this.assetPath})
      : super(key: key);

  final String text;
  final String assetPath;
  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Image.asset(assetPath),
        const Divider(height: 48),
        Text(text, textAlign: TextAlign.center),
      ],
    ));
  }
}

class CustomSlide extends StatelessWidget {
  const CustomSlide({Key? key, required this.child, required this.assetPath})
      : super(key: key);

  final Widget child;
  final String assetPath;
  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Image.asset(assetPath),
        const Divider(height: 48),
        child,
      ],
    ));
  }
}

class SlideWithButton extends StatelessWidget {
  const SlideWithButton(
      {Key? key,
      required this.text,
      required this.assetPath,
      required this.buttonText,
      required this.onPressed})
      : super(key: key);

  final String text;
  final String assetPath;
  final String buttonText;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SlideContainer(
        child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Image.asset(assetPath),
        const Divider(height: 48),
        Text(text, textAlign: TextAlign.center),
        const Divider(height: 48),
        ElevatedButton(
          onPressed: onPressed,
          child: Text(buttonText),
        ),
      ],
    ));
  }
}
