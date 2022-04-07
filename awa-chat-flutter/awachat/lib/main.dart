import 'dart:convert';
import 'dart:math';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_chat_ui/flutter_chat_ui.dart';

import 'package:awachat/notificationhandler.dart';
import 'package:awachat/pages/error.dart';
import 'package:awachat/websocketconnection.dart';
import 'package:awachat/flyer/l10n.dart';
import 'package:awachat/message.dart';
import 'package:awachat/memory.dart';
import 'package:awachat/user.dart';
import 'package:awachat/pages/agreements/agreements.dart';
import 'package:url_launcher/url_launcher.dart';

// ===== ===== =====
// App initialisation
late types.User user;
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await NotificationHandler().init();
  await Memory().init();
  await User().init();

  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  // State
  late bool hasSignedAgreements;

  @override
  void initState() {
    super.initState();

    hasSignedAgreements = false;
    String? savedHasSignedAgreements =
        Memory().get('user', 'hasSignedAgreements');
    if (savedHasSignedAgreements != null &&
        savedHasSignedAgreements == "true") {
      hasSignedAgreements = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (hasSignedAgreements) {
      return MaterialApp(
        home: MainPage(unsignAgreements: () {
          setState(() {
            hasSignedAgreements = false;
          });
          Memory().put('user', 'hasSignedAgreements', "false");
        }),
      );
    } else {
      return MaterialApp(
        home: AgreementPage(signAgreements: () {
          print("Sign Agreements");
          setState(() {
            hasSignedAgreements = true;
          });
          Memory().put('user', 'hasSignedAgreements', "true");
        }),
      );
    }
  }
}
// ===== ===== =====

// ===== ===== =====

// Debug
const Map<String, String> groupNames = {
  "0": "Zero",
  "1": "Ichi",
  "2": "Ni",
  "3": "San",
  "4": "Yon",
  "5": "Go",
  "6": "Roku",
  "7": "Nana",
  "8": "Hachi",
  "9": "Kyu",
};

// Main Page
class MainPage extends StatefulWidget {
  const MainPage({Key? key, required this.unsignAgreements}) : super(key: key);

  final VoidCallback? unsignAgreements;

  @override
  _MainPageState createState() => _MainPageState();
}

class _MainPageState extends State<MainPage> with WidgetsBindingObserver {
  // Channel
  final WebSocketConnection _webSocketConnection = WebSocketConnection();

  // Messages
  final List<types.Message> _messages = [];

  // App state (lifecycle)
  AppLifecycleState? _notification;

  // Status
  String status = "idle";

  // Report message
  void reportMessage(BuildContext context, types.Message message) async {
    HapticFeedback.lightImpact();
    switch (await actionOnMessage(context)) {
      case "ban":
        _webSocketConnection.ban(
            message.author.id, message.toJson()["text"].toString());
        break;
      case "report":
        await mailToReportMessage(_messages, message);
        break;
      default:
        print("dismiss");
    }
  }

  // Send message
  void sendMessage(types.PartialText partialText) {
    final String encodedMessage = messageEncode(partialText);
    final types.Message? message =
        messageDecode(encodedMessage, types.Status.sending);
    if (message != null) {
      setState(() {
        insertMessage(message);
      });
      _webSocketConnection.sendmessage(encodedMessage);
    }
  }

  // Insert message (sort by date - O(n))
  // TODO: O(log(n))
  void insertMessage(types.Message message) {
    if (_messages.isEmpty) {
      _messages.add(message);
      return;
    } else {
      for (int i = 0; i < _messages.length; i++) {
        if (message.createdAt! >= _messages[i].createdAt!) {
          if (message.id == _messages[i].id) {
            _messages[i] = message;
          } else {
            _messages.insert(i, message);
          }
          return;
        }
      }
    }
    _messages.add(message);
  }

  Future<void> loadMessagesFromMemory() async {
    final List<types.Message> loadedMessages = await Memory().loadMessages();
    for (final types.Message loadedMessage in loadedMessages) {
      setState(() {
        insertMessage(loadedMessage);
      });
    }
  }

  // Stream listen
  void listenStream() {
    _webSocketConnection.stream.listen((message) {
      print("Receives: $message");
      final data = jsonDecode(message);
      switch (data['action']) {
        case "register":
          print('\tRegister: ${data['status']}');
          // Get group (register on load)
          if (User().groupid == "") {
            _webSocketConnection.switchgroup();
            status = "switching";
          } else {
            loadMessagesFromMemory();
            status = "chat";
          }
          break;
        case "switchgroup":
          print('\tGroup: ${data['groupid']}');
          User().groupid = data['groupid'];
          setState(() {
            status = "chat";
          });
          break;
        case "sendmessage":
          print('\tData: ${data['data']}');
          types.Message? message = messageDecode(data['data']);
          if (message != null) {
            setState(() {
              insertMessage(message);
            });
            Memory().addMessage(data['data']);
          }
          break;
        default:
          print("\tAction ${data['action']} not recognised.");
          setState(() {
            status = "";
          });
      }
    }, onDone: () {
      setState(() {
        status = "disconnected";
      });
    }, cancelOnError: true);
  }

  // Init
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance!.addObserver(this);

    _webSocketConnection.register();
    listenStream();
  }

  @override
  Widget build(BuildContext context) {
    print("Status: $status");
    if (status == "disconnected" &&
        (_notification == null || _notification == AppLifecycleState.resumed)) {
      status = "reconnect";
      _webSocketConnection.reconnect();
      _webSocketConnection.register();
      listenStream();
    }
    return Scaffold(
        appBar: AppBar(
            foregroundColor: const Color(0xff6f61e8),
            backgroundColor: const Color(0xfff5f5f7),
            title: Text(groupNames[User().groupid] ?? ""),
            actions: <Widget>[
              PopupMenuButton<int>(onSelected: (int result) {
                if (result == 0) {
                  _webSocketConnection.switchgroup();
                  setState(() {
                    _messages.clear();
                    status = "switch";
                  });
                } else if (result == 1) {
                  widget.unsignAgreements!();
                }
              }, itemBuilder: (BuildContext context) {
                return [
                  const PopupMenuItem<int>(
                      value: 0, child: Text("Je veux changer de groupe")),
                  const PopupMenuItem<int>(
                      value: 1, child: Text("Je veux revoir la présentation")),
                ];
              })
            ]),
        body: SafeArea(
            bottom: false,
            child: Builder(
              builder: (BuildContext context) {
                switch (status) {
                  case "idle":
                    return const Center(
                        child: CircularProgressIndicator(
                            color: Color(0xff6f61e8)));
                  case "switch":
                    return const Center(
                        child: CircularProgressIndicator(
                            color: Color(0xff6f61e8)));
                  case "chat":
                    return Chat(
                      l10n: const ChatL10nFr(),
                      messages: _messages,
                      onSendPressed: sendMessage,
                      onMessageLongPress: reportMessage,
                      user: User().user,
                      theme: const DefaultChatTheme(
                          inputBackgroundColor: Color(0xfff5f5f7),
                          inputTextColor: Color(0xff1f1c38),
                          inputTextCursorColor: Color(0xff9e9cab)),
                    );
                  case "disconnected":
                    return Stack(
                      children: [
                        Chat(
                          l10n: const ChatL10nFr(),
                          messages: _messages,
                          onSendPressed: sendMessage,
                          user: User().user,
                          theme: const DefaultChatTheme(
                              inputBackgroundColor: Color(0xfff5f5f7),
                              inputTextColor: Color(0xff1f1c38),
                              inputTextCursorColor: Color(0xff9e9cab)),
                        ),
                        Positioned.fill(
                            child: BackdropFilter(
                                filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
                                child: Container(
                                    color: Colors.black.withOpacity(0))))
                      ],
                    );
                  case "reconnect":
                    return const Center(
                        child: CircularProgressIndicator(
                            color: Color(0xff6f61e8)));
                  default:
                    return const ErrorPage();
                }
              },
            )));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    print("Change state > $state");
    setState(() {
      _notification = state;
    });

    if (state != AppLifecycleState.resumed) {
      _webSocketConnection.close();
    }
  }

  @override
  void dispose() {
    _webSocketConnection.close();
    WidgetsBinding.instance!.removeObserver(this);
    super.dispose();
  }
}
