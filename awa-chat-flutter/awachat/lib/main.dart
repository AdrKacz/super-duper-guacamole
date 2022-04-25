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
    List<Widget> actions = [
      TextButton(
        child: const Text('Ok'),
        onPressed: () {
          Navigator.of(context).pop();
        },
      ),
    ];
    switch (status) {
      case 'confirmed':
        if (banneduserid == User().id) {
          title = "Tu t'es fait banir de ton groupe";
        } else {
          title = 'La personne est banie de ton groupe';
          actions.insert(
              0,
              TextButton(
                child: const Text('Supprimer tous ses messages'),
                onPressed: () {
                  final List<types.Message> messagesToRemove = [];
                  for (final types.Message e in _messages) {
                    if (e.author.id == banneduserid) {
                      messagesToRemove.add(e);
                    }
                  }
                  for (final types.Message e in messagesToRemove) {
                    deleteMessage(e);
                  }

                  Navigator.of(context).pop();
                },
              ));
        }
        break;
      case 'denied':
        if (banneduserid == User().id) {
          return; // no need to alert the user
        } else {
          title = "La personne n'est pas banie de ton groupe";
        }
        break;
      default:
        return;
    }
    showDialog(
        context: context,
        builder: (BuildContext context) {
          return AlertDialog(
            title: Text(title),
            actions: actions,
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

  void deleteMessage(types.Message message) {
    // remove the message locally
    setState(() {
      _messages.remove(message);
    });
    // remove the message in memory
    Memory().deleteMessage(message.id);
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
        deleteMessage(message);
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
      insertMessage(message);
      _webSocketConnection.textmessage(encodedMessage);
    }
  }

  // Insert message (sort by date - O(n))
  // TODO: O(log(n))
  void insertMessage(types.Message message,
      {bool useHaptic = true, bool useSetState = true}) {
    if (useHaptic && message.status == types.Status.delivered) {
      HapticFeedback.lightImpact();
    }

    if (_messages.isEmpty) {
      setState(() {
        _messages.add(message);
      });
      return;
    } else {
      for (int i = 0; i < _messages.length; i++) {
        if (message.createdAt! >= _messages[i].createdAt!) {
          if (message.id == _messages[i].id) {
            if (useSetState) {
              setState(() {
                _messages[i] = message;
              });
            } else {
              _messages[i] = message;
            }
          } else {
            if (useSetState) {
              setState(() {
                _messages.insert(i, message);
              });
            } else {
              _messages.insert(i, message);
            }
          }
          return;
        }
      }
    }
    if (useSetState) {
      setState(() {
        _messages.add(message);
      });
    } else {
      _messages.add(message);
    }
  }

  Future<void> loadMessagesFromMemory() async {
    final List<types.Message> loadedMessages = await Memory().loadMessages();
    print('Loaded messages length: ${loadedMessages.length}');
    _messages.clear();
    for (final types.Message loadedMessage in loadedMessages) {
      insertMessage(loadedMessage, useHaptic: false, useSetState: false);
    }
  }

  bool processMessage(message) {
    bool needUpdate = true;
    final data = jsonDecode(message);
    switch (data['action']) {
      case "register":
        print('\tRegister');
        // process unread messages
        for (final unreadMessage in data['unreadData']) {
          needUpdate = processMessage(jsonEncode(unreadMessage));
        }

        // Get group (register on load)
        if (User().groupid == "") {
          _webSocketConnection.switchgroup();
          _messages.clear();
          state = "switch";
        } else {
          // past messages
          loadMessagesFromMemory();
          state = "chat";
        }
        break;
      case "leavegroup":
        if (data['groupid'] == User().groupid) {
          // only leave if the group to leave is the group we are in
          print('\tLeave group: ${data['groupid']}');
          User().groupid = data['groupid'];
          _messages.clear();
          state = "switch";
        } else {
          // don't do anything
          needUpdate = false;
        }
        break;
      case "joingroup":
        if (data['groupid'] != User().groupid) {
          // only join if the group to join is not the group we are in
          print('\tJoin group: ${data['groupid']}');
          User().groupid = data['groupid'];
          _messages.clear(); // in case we receive join before leave
          state = "chat";
        } else {
          // don't do anything
          needUpdate = false;
        }
        break;
      case "textmessage":
        print('\tMessage: ${data['message']}');
        types.Message? message = messageDecode(data['message']);
        if (message != null) {
          insertMessage(message, useSetState: false);
          Memory().addMessage(message.id, data['message']);
        }
        break;
      case "banrequest":
        print('\tBan request for: ${data['messageid']}');
        banRequest(context, data['messageid']);
        needUpdate = false;
        break;
      case "banreply":
        print(
            '\tBan reply for: ${data['bannedid']} with status ${data['status']}');
        acknowledgeBan(context, data['status'], data['bannedid']);
        needUpdate = false;
        break;
      default:
        print("\tAction ${data['action']} not recognised.");
        state = "";
    }
    return needUpdate;
  }

  void listenMessage(message) {
    print("Message: $message");
    bool needUpdate = processMessage(message);
    if (needUpdate) {
      setState(() {});
    }
  }

  // Stream listen
  void listenStream() {
    _webSocketConnection.stream.listen(listenMessage, onDone: () {
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
            User().groupid = "";
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
                    if (state != "chat") {
                      return;
                    }
                    _webSocketConnection.switchgroup();
                    setState(() {
                      state = "switch";
                    });
                  },
                  icon: Icon(
                    Icons.door_front_door_outlined,
                    color: state == "chat"
                        ? const Color(0xff6f61e8)
                        : const Color(0xff9e9cab),
                  )),
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
