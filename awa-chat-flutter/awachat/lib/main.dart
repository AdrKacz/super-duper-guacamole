import 'dart:convert';
import 'dart:ui';

import 'package:awachat/pages/custom_chat.dart';
import 'package:awachat/pages/presentation.dart';
import 'package:awachat/user_drawer.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;

import 'package:awachat/notification_handler.dart';
import 'package:awachat/pages/error.dart';
import 'package:awachat/web_socket_connection.dart';
import 'package:awachat/message.dart';
import 'package:awachat/memory.dart';
import 'package:awachat/user.dart';
import 'package:awachat/pages/agreements.dart';

// ===== ===== =====
// App initialisation
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
  // State {presentation, agreements, main}
  late String state;

  @override
  void initState() {
    super.initState();

    // retreive app state
    state = Memory().get('user', 'appState') ?? "presentation";
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
        Memory().get('user', 'hasSignedAgreements') == "true") {
      state = 'main';
    }
    return MaterialApp(home: Builder(
      builder: (BuildContext context) {
        switch (state) {
          case 'presentation':
            return Presentation(setAppState: setAppState);
          case 'agreements':
            return Agreements(setAppState: setAppState);
          case 'main':
            return MainPage(setAppState: setAppState);
          default:
            print('Unknown state $state');
            return const Placeholder();
        }
      },
    ));
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
  const MainPage({Key? key, required this.setAppState}) : super(key: key);

  final Function setAppState;

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

  // State
  String state = "idle";

  // Acknowledge ban
  void acknowledgeBan(
      BuildContext context, String status, String banneduserid) {
    String title = "";
    switch (status) {
      case 'confirmed':
        if (banneduserid == User().id) {
          title = "Tu viens de te faire banir du groupe";
        } else {
          title = 'La personne a été banie du groupe';
        }
        break;
      case 'denied':
        title = "La personne n'a pas été banie du groupe";
        break;
    }
    showDialog(
        context: context,
        builder: (BuildContext context) {
          return AlertDialog(
            title: Text(title),
            actions: <Widget>[
              TextButton(
                child: const Text('Ok'),
                onPressed: () {
                  Navigator.of(context).pop();
                },
              ),
            ],
          );
        });
  }

  // Find message
  types.Message? findMessage(String messageid) {
    for (final types.Message message in _messages) {
      if (message.id == messageid) {
        return message;
      }
    }
    return null;
  }

  // Ban request
  void banRequest(BuildContext context, String messageid) async {
    // find message
    types.Message? message = findMessage(messageid);
    if (message == null) {
      print("Message $messageid wasn't found. Returns.");
      return;
    }

    print("Found message $messageid:\n$message");

    HapticFeedback.mediumImpact();
    switch (await banActionOnMessage(context, message)) {
      case 'confirmed':
        print('Ban confirmed');
        _webSocketConnection.banreply(message.author.id, 'confirmed');
        break;
      case 'denied':
        print('Ban denied');
        _webSocketConnection.banreply(message.author.id, 'denied');
        break;
      default:
        throw Exception('Ban action not in ["confirmed", "denied"]');
    }
  }

  // Report message
  void reportMessage(BuildContext context, types.Message message) async {
    HapticFeedback.mediumImpact();
    switch (await reportActionOnMessage(context)) {
      case "ban":
        _webSocketConnection.banrequest(message.author.id, message.id);
        break;
      case "report":
        await mailToReportMessage(_messages, message);
        break;
      case 'delete':
        // remove the message locally
        setState(() {
          _messages.remove(message);
        });
        // remove the message in memory
        Memory().deleteMessage(message.id);
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
  void insertMessage(types.Message message, [bool? useHaptic]) {
    useHaptic ??= true;
    if (useHaptic && message.status == types.Status.delivered) {
      HapticFeedback.lightImpact();
    }

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
    print('Loaded messages length: ${loadedMessages.length}');
    setState(() {
      _messages.clear();
    });
    for (final types.Message loadedMessage in loadedMessages) {
      setState(() {
        insertMessage(loadedMessage, false);
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
            setState(() {
              _messages.clear();
              state = "switch";
            });
          } else {
            loadMessagesFromMemory();
            setState(() {
              state = "chat";
            });
          }
          break;
        case "switchgroup":
          print('\tGroup: ${data['groupid']}');
          User().groupid = data['groupid'];
          setState(() {
            _messages
                .clear(); // clear here too if switchgroup without user asked to (ban)
            state = "chat";
          });
          break;
        case "sendmessage":
          print('\tData: ${data['data']}');
          types.Message? message = messageDecode(data['data']);
          if (message != null) {
            setState(() {
              insertMessage(message);
            });
            Memory().addMessage(message.id, data['data']);
          }
          break;
        case "banrequest":
          print('\tBan request for: ${data['messageid']}');
          banRequest(context, data['messageid']);
          break;
        case "banconfirmed":
          print('\tBan confirmed for: ${data['banneduserid']}');
          acknowledgeBan(context, 'confirmed', data['banneduserid']);
          break;
        case "bandenied":
          print('\tBan denied for: ${data['banneduserid']}');
          acknowledgeBan(context, 'denied', data['banneduserid']);
          break;
        default:
          print("\tAction ${data['action']} not recognised.");
          setState(() {
            state = "";
          });
      }
    }, onDone: () {
      if (mounted) {
        setState(() {
          state = "disconnected";
        });
      }
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
    if (state == "disconnected" &&
        (_notification == null || _notification == AppLifecycleState.resumed)) {
      state = "reconnect";
      _webSocketConnection.reconnect();
      _webSocketConnection.register();
      listenStream();
    }
    print("State: $state");
    return Scaffold(
        drawer: UserDrawer(
          seeIntroduction: () {
            widget.setAppState('presentation');
          },
          resetAccount: () async {
            await Memory().clear();
            await User().init();
            widget.setAppState('presentation');
          },
        ),
        appBar: AppBar(
            foregroundColor: const Color(0xff6f61e8),
            backgroundColor: const Color(0xfff5f5f7),
            leading: Builder(
              builder: (BuildContext context) {
                return InkWell(
                  onTap: () {
                    Scaffold.of(context).openDrawer();
                  },
                  child: CircleAvatar(
                    backgroundColor: Colors.transparent,
                    foregroundImage: NetworkImage(
                        "https://avatars.dicebear.com/api/croodles-neutral/${User().id}.png"),
                  ),
                );
              },
            ),
            title: Text(groupNames[User().groupid] ?? ""),
            actions: <Widget>[
              IconButton(
                  tooltip: "Changer de groupe",
                  onPressed: () {
                    _webSocketConnection.switchgroup();
                    setState(() {
                      _messages.clear();
                      state = "switch";
                    });
                  },
                  icon: const Icon(Icons.door_front_door_outlined)),
            ]),
        body: SafeArea(
            bottom: false,
            child: Builder(
              builder: (BuildContext context) {
                switch (state) {
                  case "idle":
                    return const Center(
                        child: CircularProgressIndicator(
                            color: Color(0xff6f61e8)));
                  case "switch":
                    return const Center(
                        child: CircularProgressIndicator(
                            color: Color(0xff6f61e8)));
                  case "chat":
                    return CustomChat(
                        messages: _messages,
                        onSendPressed: sendMessage,
                        onMessageLongPress: reportMessage);
                  case "disconnected":
                    return Stack(
                      children: [
                        CustomChat(
                            messages: _messages,
                            onSendPressed: sendMessage,
                            onMessageLongPress: reportMessage),
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
                    return ErrorPage(
                      refresh: () {
                        _webSocketConnection.close();
                        _webSocketConnection.reconnect();
                        _webSocketConnection.register();
                        listenStream();
                      },
                    );
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
