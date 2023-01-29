import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class Presentation extends StatelessWidget {
  const Presentation({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final slides = <Widget>[
      const Slide(
        text: '''Bienvenue sur Awa !
        
Tu es au bon endroit pour de nouvelles rencontres.''',
        assetPath: 'assets/images/onboard-page-1.png',
      ),
      const Slide(
          text: """Tu vas entrer dans un groupe de conversation.

C'est le moment idéal pour partager tes points communs et tes activités favorites !""",
          assetPath: 'assets/images/onboard-page-2.png'),
      const CustomSlide(
          assetPath: 'assets/images/onboard-page-3.png',
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(text: '''Pour changer de groupe, sélectionne la '''),
                WidgetSpan(child: Icon(Icons.door_front_door_outlined)),
                TextSpan(text: ''' en haut à droite de ton écran.
                    
Tu ne pourras plus revenir en arrière, ici on préfère la qualité à la quantité.''')
              ],
            ),
            textAlign: TextAlign.center,
          )),
      const Slide(
          text: """Si un message t'offense, reste appuyé dessus.

Tu pourras le supprimer, le signaler, ou bien expulser du groupe la personne qui l'a écrit.""",
          assetPath: 'assets/images/onboard-page-4.png'),
      SlideWithButton(
        text: 'Hâte de te faire de nouveaux potes ?',
        assetPath: 'assets/images/onboard-page-5.png',
        buttonText: "C'est parti !",
        onPressed: () {
          context.go('/agreements');
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
