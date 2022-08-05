import 'package:awachat/application_theme.dart';
import 'package:awachat/widgets/chat/main.dart';
import 'package:awachat/widgets/questions.dart';
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
  await NotificationHandler().init();

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  State<MyApp> createState() => _MyAppState();
}

enum Status { presentation, agreements, firstTimeQuestions, main, other }

class _MyAppState extends State<MyApp> {
  Status get status {
    String statusName =
        Memory().get('user', 'appStatus') ?? Status.presentation.name;
    for (final Status value in Status.values) {
      if (statusName == value.name) {
        return value;
      }
    }
    return Status.other;
  }

  set status(Status newStatus) {
    Memory().put('user', 'appStatus', newStatus.name);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (status == Status.agreements &&
        Memory().get('user', 'hasSignedAgreements') == 'true') {
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
                status = Status.firstTimeQuestions;
              });
            case Status.firstTimeQuestions:
              return FirstTimeQuestionsLoader(
                onConfirmed: () {
                  status = Status.main;
                },
              );
            case Status.main:
              return ChatHandler(goToPresentation: () {
                status = Status.presentation;
              });
            default:
              // unknown state
              return const Placeholder();
          }
        },
      ),
    );
  }
}
