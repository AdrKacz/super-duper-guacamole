import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:awachat/store/memory.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

// Question Tree
class CitiesQuestion extends StatelessWidget {
  const CitiesQuestion({Key? key, required this.cities}) : super(key: key);

  final List<String> cities;

  void showConfirmDialog(BuildContext context) async {
    if (!Memory().boxUser.containsKey('hasSelectedCityOnce')) {
      Memory().boxUser.put('hasSelectedCityOnce',
          DateTime.now().millisecondsSinceEpoch.toString());
      return;
    }
    return await showDialog(
        context: context,
        builder: (BuildContext context) {
          return AlertDialog(
              title: const Text(
                  'Ton choix sera pris en compte la prochaine fois que tu changes de groupe.'),
              actions: <Widget>[
                TextButton(
                    onPressed: () => (Navigator.pop(context)),
                    child: const Text('Ok'))
              ]);
        });
  }

  ButtonStyle getButtonStyle(BuildContext context, bool isActive) {
    if (isActive) {
      return ElevatedButton.styleFrom(
          minimumSize: const Size.fromHeight(100),
          backgroundColor: Theme.of(context).colorScheme.onSecondary,
          foregroundColor: Theme.of(context).colorScheme.onBackground);
    } else {
      return ElevatedButton.styleFrom(
          minimumSize: const Size.fromHeight(100),
          backgroundColor: Theme.of(context).colorScheme.background,
          foregroundColor: Theme.of(context).colorScheme.onBackground);
    }
  }

  void selectCity(
      BuildContext context, String selectedCity, String currentCity) {
    if (selectedCity == currentCity) {
      // un-select
      Memory().boxUser.delete('city');
    } else {
      // save
      Memory().boxUser.put('city', selectedCity);

      // quit
      Future.delayed(const Duration(milliseconds: 250))
          .then((value) => (context.go('/chat')))
          .then((value) => (Future.delayed(const Duration(milliseconds: 250))))
          .then((value) => (showConfirmDialog(context)));
    }
  }

  @override
  Widget build(BuildContext context) => (SafeArea(
      child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            const Text('Où est-ce que tu veux sortir ?',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 16)),
            const Divider(height: 24),
            Expanded(
                child: ValueListenableBuilder(
                    valueListenable: Hive.box<String>(Memory.user).listenable(),
                    builder: (BuildContext context, Box box, widget) {
                      final String currentCity = box.get('city') ?? '';

                      return ListView(
                          children: List<Widget>.from([
                        ...cities,
                        'Je ne trouve pas ma ville'
                      ].map((city) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: ElevatedButton(
                                  style: getButtonStyle(
                                      context, city == currentCity),
                                  onPressed: () {
                                    selectCity(context, city, currentCity);
                                  },
                                  child: Text(city,
                                      textAlign: TextAlign.center))))));
                    })),
            const Divider(
              height: 24,
            ),
            Text.rich(
                TextSpan(children: [
                  TextSpan(
                      text: '''Envoie nous un message ''',
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.onPrimary,
                          decoration: TextDecoration.underline,
                          fontWeight: FontWeight.bold),
                      recognizer: TapGestureRecognizer()
                        ..onTap = () async {
                          if (!await launchUrl(
                              Uri.parse('https://awa-chat.me/contact/'))) {
                            throw 'Could not launch https://awa-chat.me/contact/';
                          }
                        }),
                  const TextSpan(text: ''' si tu ne trouves pas ta ville.
Choisis '''),
                  TextSpan(
                      text: '''Je ne trouve pas ma ville''',
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.onPrimary,
                          fontWeight: FontWeight.bold)),
                  const TextSpan(text: ''' pour discuter en attendant !'''),
                ]),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, height: 1.5))
          ]))));
}
