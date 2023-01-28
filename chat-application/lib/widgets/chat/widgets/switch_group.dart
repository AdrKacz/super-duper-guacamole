import 'package:flutter/material.dart';

class SwitchGroupPage extends StatelessWidget {
  const SwitchGroupPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: ListView(
          physics: const ClampingScrollPhysics(),
          shrinkWrap: true,
          padding: const EdgeInsets.all(24.0),
          children: [
            Image.asset('assets/images/load-group.gif'),
            const SizedBox(
              height: 24,
            ),
            const Text(
              """Plus qu'à patienter le temps qu'il y ait assez de monde.
              
Tu recevras une notification quand tout sera prêt, tu peux t'en aller pour le moment.""",
              textAlign: TextAlign.center,
            ),
            const SizedBox(
              height: 24,
            ),
            Center(
              child: CircularProgressIndicator(
                  color: Theme.of(context).colorScheme.onPrimary),
            ),
          ],
        ),
      ),
    );
  }
}
