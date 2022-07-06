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
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  // State {presentation, agreements, main}
  late String state;

  @override
  void initState() {
    super.initState();

    // retreive app state
    state = Memory().get('user', 'appState') ?? 'presentation';
  }

  void setAppState(String newAppState) {
    Memory().put('user', 'appState', newAppState);
    setState(() {
      state = newAppState;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (state == 'agreements' &&
        Memory().get('user', 'hasSignedAgreements') == 'true') {
      state = 'main';
    }
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: applicationTheme,
      home: Builder(
        builder: (BuildContext context) {
          switch (state) {
            case 'presentation':
              return Presentation(setAppState: setAppState);
            case 'agreements':
              return Agreements(setAppState: setAppState);
            case 'main':
              // check user has answers to questions
              final String? questions = Memory().get('user', 'questions');
              if (questions == null) {
                // TODO: use route instead
                return FirstTimeQuestionsLoader(
                  onConfirmed: () {
                    setState(() {});
                  },
                );
              } else {
                return ChatPage(setAppState: setAppState);
              }
            default:
              print('Unknown state $state');
              return const Placeholder();
          }
        },
      ),
    );
  }
}
