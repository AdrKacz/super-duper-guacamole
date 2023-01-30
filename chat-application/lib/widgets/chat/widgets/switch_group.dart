import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';

class SwitchGroupPage extends StatelessWidget {
  const SwitchGroupPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final String city = Memory().boxUser.get('group-city')!;

    final List<TextSpan> textSpanChildren = [
      const TextSpan(text: '''Plus qu'à patienter pour trouver du monde'''),
      const TextSpan(text: '''.

Tu recevras une notification quand tout sera prêt, tu peux t'en aller pour le moment.'''),
    ];

    if (city != 'Je ne trouve pas ma ville') {
      textSpanChildren.insertAll(1, [
        const TextSpan(text: ''' à '''),
        TextSpan(
            text: city,
            style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.onPrimary))
      ]);
    }

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
            Text.rich(TextSpan(children: textSpanChildren),
                textAlign: TextAlign.center),
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
