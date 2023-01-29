import 'package:awachat/application_theme.dart';
import 'package:awachat/widgets/chat/main.dart';
import 'package:awachat/widgets/cities/cities_loader.dart';
import 'package:flutter/material.dart';

import 'package:awachat/network/notification_handler.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/presentation.dart';
import 'package:awachat/widgets/agreements.dart';
import 'package:hive_flutter/hive_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Memory().init();
  await User().init();
  NotificationHandler().init();

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  State<MyApp> createState() => _MyAppState();
}

enum Status { presentation, agreements, main }

class _MyAppState extends State<MyApp> {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: applicationTheme,
      home: ValueListenableBuilder(
        valueListenable: Memory().boxUser.listenable(),
        builder: (BuildContext context, Box box, widget) {
          final String statusName = Memory().boxUser.get('appStatus') ?? '';

          Status status = Status.presentation;
          for (final Status value in Status.values) {
            if (statusName == value.name) {
              status = value;
              break;
            }
          }

          if (status == Status.agreements &&
              Memory().boxUser.get('hasSignedAgreements') == 'true') {
            Memory().boxUser.put('appStatus', Status.main.name);
          }

          switch (status) {
            case Status.presentation:
              return const Presentation();
            case Status.agreements:
              return const Agreements();
            case Status.main:
              if (!Memory().boxUser.containsKey('city')) {
                return const CitiesLoader();
              } else {
                return ChatHandler(goToPresentation: () {
                  status = Status.presentation;
                });
              }
          }
        },
      ),
    );
  }
}
