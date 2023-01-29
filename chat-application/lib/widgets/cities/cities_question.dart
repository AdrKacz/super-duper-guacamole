import 'package:flutter/material.dart';
import 'package:awachat/store/memory.dart';
import 'package:hive_flutter/hive_flutter.dart';

// Question Tree
class CitiesQuestion extends StatelessWidget {
  const CitiesQuestion({Key? key, required this.cities}) : super(key: key);

  final List<String> cities;

  void showConfirmDialog(BuildContext context) async {
    return await showDialog(
        context: context,
        builder: (BuildContext context) {
          return AlertDialog(
              title: const Text(
                  'Ton choix sera pris en compte la prochaine fois que tu changes de groupe.'),
              actions: <Widget>[
                TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                  },
                  child: const Text('Ok'),
                ),
              ]);
        });
  }

  ButtonStyle getButtonStyle(BuildContext context, bool isActive) {
    if (isActive) {
      return ElevatedButton.styleFrom(
        minimumSize: const Size.fromHeight(100),
        backgroundColor: Theme.of(context).colorScheme.onSecondary,
        foregroundColor: Theme.of(context).colorScheme.onBackground,
      );
    } else {
      return ElevatedButton.styleFrom(
        minimumSize: const Size.fromHeight(100),
        backgroundColor: Theme.of(context).colorScheme.background,
        foregroundColor: Theme.of(context).colorScheme.onBackground,
      );
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
          .then((value) => {Navigator.pop(context)})
          .then((value) => {showConfirmDialog(context)});
    }
  }

  @override
  Widget build(BuildContext context) => (SafeArea(
      child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            const Text(
              'Où est-ce que tu veux sortir ?',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16),
            ),
            const Divider(
              height: 24,
            ),
            Expanded(
                child: ValueListenableBuilder(
                    valueListenable: Hive.box<String>(Memory.user).listenable(),
                    builder: (BuildContext context, Box box, widget) {
                      final String currentCity = box.get('city') ?? '';

                      return ListView(
                          children: List<Widget>.from(cities.map((city) =>
                              Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 12),
                                  child: ElevatedButton(
                                      style: getButtonStyle(
                                          context, city == currentCity),
                                      onPressed: () {
                                        selectCity(context, city, currentCity);
                                      },
                                      child: Text(
                                        city,
                                        textAlign: TextAlign.center,
                                      ))))));
                    }))
          ]))));
}
