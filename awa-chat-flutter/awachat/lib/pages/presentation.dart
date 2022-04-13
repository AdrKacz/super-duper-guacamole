import 'package:flutter/material.dart';

import 'package:awachat/pages/slide.dart';

class Presentation extends StatelessWidget {
  const Presentation({Key? key, required this.setAppState}) : super(key: key);

  final Function setAppState;

  @override
  Widget build(BuildContext context) {
    final slides = <Widget>[
      const Slide(
        text: """Je suis Awa.
Je vais te présenter l'application.
""",
        assetPath: 'assets/images/undraw_super_woman_dv-0-y.png',
      ),
      const Slide(
          text: """Je vais te faire entrer dans un groupe de conversation.
  
Je t'alerterai quand les gens parleront sur la conversation.""",
          assetPath: 'assets/images/undraw_social_interaction_re_dyjh.png'),
      const Slide(
          text: """Je n'enregistre aucun de tes messages.
          
Si tu n'es pas là pour les recevoir, tu ne les verras pas.""",
          assetPath: 'assets/images/undraw_void_-3-ggu.png'),
      const CustomSlide(
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(text: """Tu ne seras que dans un groupe à la fois.
          
Clique sur """),
                WidgetSpan(
                    child: Icon(
                  Icons.door_front_door_outlined,
                  color: Color(0xff6f61e8),
                )),
                TextSpan(
                    text:
                        " en haut à droite de ton écran pour changer de groupe.")
              ],
            ),
            textAlign: TextAlign.center,
          ),
          assetPath: 'assets/images/undraw_login_re_4vu2.png'),
      const Slide(
          text: """Si un message t'offense, reste appuyé dessus.

Tu pourras le supprimer, me le signaler, ou bien expulser du groupe la personne qui l'a écrit.""",
          assetPath: 'assets/images/undraw_people_re_8spw.png'),
      const Slide(
          text: """Si la conversation se passe bien, donnez-vous rendez-vous !
          
Un verre en terrasse, une expo', une balade au soleil, il y a toujours de quoi faire.""",
          assetPath: 'assets/images/undraw_having_fun_re_vj4h.png'),
      SlideWithButton(
          text: "Tu as hâte de faire des rencontres ?",
          assetPath: 'assets/images/undraw_joyride_re_968t.png',
          buttonText: "C'est parti !",
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
