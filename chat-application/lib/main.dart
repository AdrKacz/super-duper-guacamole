import 'package:awachat/application_theme.dart';
import 'package:awachat/widgets/chat/main.dart';
import 'package:awachat/widgets/cities/cities_loader.dart';
import 'package:flutter/material.dart';

import 'package:awachat/network/notification_handler.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/presentation.dart';
import 'package:awachat/widgets/agreements.dart';

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
  Status get status {
    String statusName =
        Memory().boxUser.get('appStatus') ?? Status.presentation.name;
    for (final Status value in Status.values) {
      if (statusName == value.name) {
        return value;
      }
    }
    return Status.presentation;
  }

  set status(Status newStatus) {
    Memory().boxUser.put('appStatus', newStatus.name);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (status == Status.agreements &&
        Memory().boxUser.get('hasSignedAgreements') == 'true') {
      status = Status.main;
    }
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: applicationTheme,
      home: Builder(
        builder: (BuildContext context) {
          switch (status) {
            case Status.presentation:
              return Presentation(nextAppStatus: () {
                status = Status.agreements;
              });
            case Status.agreements:
              return Agreements(nextAppStatus: () {
                status = Status.main;
              });
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
