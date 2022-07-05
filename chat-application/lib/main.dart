import 'dart:convert';

import 'package:awachat/application_theme.dart';
import 'package:awachat/store/config/config.dart';
import 'package:awachat/store/group/group.dart';
import 'package:awachat/widgets/glass.dart';
import 'package:awachat/widgets/questions.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;

import 'package:awachat/objects/notification_handler.dart';
import 'package:awachat/objects/web_socket_connection.dart';
import 'package:awachat/message.dart';
import 'package:awachat/store/user/user.dart';
import 'package:awachat/widgets/loader.dart';
import 'package:awachat/widgets/user_drawer.dart';
import 'package:awachat/widgets/users_list.dart';
import 'package:awachat/widgets/error.dart';
import 'package:awachat/widgets/custom_chat.dart';
import 'package:awachat/widgets/presentation.dart';
import 'package:awachat/widgets/switch_group.dart';
import 'package:awachat/widgets/agreements.dart';
import 'package:hive_flutter/hive_flutter.dart';

// ===== ===== =====
// App initialisation
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Hive.initFlutter();
  await Hive.openBox('metadata');

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
        Config.config.booleanParameters['hasSignedAgreements'] == true) {
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
              if (Config.config.answeredQuestions.isEmpty) {
                // TODO: use route instead
                return FirstTimeQuestionsLoader(
                  onConfirmed: () {
                    setState(() {});
                  },
                );
              } else {
                return MainPage(setAppState: setAppState);
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

// ===== ===== =====
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
  late String _state;
  String get state => _state;
  set state(String newState) {
    Memory().put('user', 'appChatState', newState);
    _state = newState;
  }

  String connectionState = 'connected';

  // Acknowledge ban
  void acknowledgeBan(
      BuildContext context, String status, String banneduserid) {
    String title = '';
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
        if (banneduserid == User.me.id) {
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
        if (banneduserid == User.me.id) {
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

    print('Found message $messageid:\n$message');

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

  void blockUser(String userId) {
    Memory().addBlockedUser(userId);
    _webSocketConnection.switchgroup();
    setState(() {
      state = 'switch';
    });
  }

  // Report message
  void reportMessage(BuildContext context, types.Message message) async {
    HapticFeedback.mediumImpact();
    switch (await reportActionOnMessage(context)) {
      case 'ban':
        _webSocketConnection.banrequest(message.author.id, message.id);
        break;
      case 'report':
        await mailToReportMessage(_messages, message);
        break;
      case 'delete':
        deleteMessage(message);
        break;
      case 'block':
        blockUser(message.author.id);
        break;
      default:
        print('dismiss');
    }
  }

  // Send message
  void sendMessage(types.PartialText partialText) {
    final String encodedMessage = messageEncode(partialText);
    final types.Message? message =
        messageDecode(encodedMessage, types.Status.sending);
    if (message != null) {
      insertMessage(message);
      setState(() {});
      _webSocketConnection.textmessage(encodedMessage);
    }
  }

  // Insert message (sort by date - O(n))
  // TODO: O(log(n))
  void insertMessage(types.Message message, {bool useHaptic = true}) {
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
    final List<types.Message> loadedMessages = Memory().loadMessages();
    print('Loaded messages length: ${loadedMessages.length}');
    _messages.clear();
    for (final types.Message loadedMessage in loadedMessages) {
      insertMessage(loadedMessage, useHaptic: false);
    }
    setState(() {});
  }

  bool processMessage(message, {bool isInnerLoop = false}) {
    bool needUpdate = true;
    final data = jsonDecode(message);
    switch (data['action']) {
      case 'login':
        User.loads(data['id']).isOnline = true;
        break;
      case 'logout':
        User.loads(data['id']).isOnline = false;
        break;
      case 'register':
        print('\tRegister with state: $state');
        // connection made
        connectionState = 'connected';
        // process unread messages
        for (final unreadMessage in data['unreadData']) {
          processMessage(jsonEncode(unreadMessage), isInnerLoop: true);
          // needUpdate cannot be false because connectionState changed
        }

        final String assignedGroupId = data['group'] ?? '';
        if (assignedGroupId == '' ||
            (Group.main.id != '' && assignedGroupId != Group.main.id)) {
          // there was an error somewhere, just re-init the group
          NotificationHandler().init(); // register notification token
          Group.main.change('');

          _webSocketConnection.switchgroup();
          _messages.clear();
          state = 'switch';
        } else if (Group.main.id == '' && state == 'idle') {
          // Get group (register on load)
          _webSocketConnection.switchgroup();
          _messages.clear();
          state = 'switch';
        } else if (state == 'chat') {
          // past messages
          loadMessagesFromMemory();
        }
        break;
      case 'leavegroup':
        // empty string is stored as undefined serverside
        // (causing a difference when there is not)
        final String groupId = data['groupid'] ?? '';
        final String userId = data['id'];
        if (userId == User.me.id) {
          if (groupId == Group.main.id) {
            // only leave if the group to leave is the group we are in
            print('\tLeave group: $groupId');
            Group.main.change('');
            _messages.clear();
            state = 'switchwaiting';
          } else {
            // don't do anything
            needUpdate = false;
          }
        } else {
          if (groupId == Group.main.id) {
            Hive.box('metadata').delete(userId);
          }
        }

        break;
      case 'joingroup':
        final String newGroupId = data['groupid'] ?? '';
        final Map<String, dynamic> users =
            Map<String, dynamic>.from(data['users'] ?? {});
        if (users.remove(User.me.id) != null) {
          if (newGroupId != Group.main.id) {
            // only join if the group to join is not the group we are in
            print('\tJoin group: $newGroupId');
            Group.main.change(newGroupId);
            Group.main.addAllUsers(users.values.map((e) => User.loads(e['id'],
                id: e['id'], isOnline: e['isActive'] ?? false)));
            _messages.clear(); // in case we receive join before leave
            state = 'chat';
          } else {
            // new users in group
            print('\tGroup users: $users');
            Group.main.addAllUsers(users.values.map((e) => User.loads(e['id'],
                id: e['id'], isOnline: e['isActive'] ?? false)));
          }
        } else {
          // don't do anything (user not concerted, error)
          needUpdate = false;
        }

        break;
      case 'textmessage':
        print('\tMessage: ${data['message']}');
        types.Message? message = messageDecode(data['message']);
        if (message != null) {
          if (!isInnerLoop) {
            insertMessage(message);
          }
          Memory().addMessage(message.id, data['message']);
        }
        break;
      case 'banrequest':
        print('\tBan request for: ${data['messageid']}');
        banRequest(context, data['messageid']);
        needUpdate = false;
        break;
      case 'banreply':
        print(
            '\tBan reply for: ${data['bannedid']} with status ${data['status']}');
        acknowledgeBan(context, data['status'], data['bannedid']);
        needUpdate = false;
        break;
      default:
        print("\tAction ${data['action']} not recognised.");
        state = '';
    }
    return needUpdate;
  }

  void listenMessage(message) {
    print('Receive message: $message');
    if (processMessage(message)) {
      setState(() {});
    }
  }

  // Stream listen
  void listenStream() {
    _webSocketConnection.stream.listen(listenMessage, onDone: () {
      if (mounted) {
        setState(() {
          connectionState = 'disconnected';
        });
      }
    }, cancelOnError: true);
  }

  // Init
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _state = Memory().get('user', 'appChatState') ?? 'idle';

    _webSocketConnection.register();
    listenStream();
  }

  @override
  Widget build(BuildContext context) {
    if (connectionState == 'disconnected' &&
        (_notification == null || _notification == AppLifecycleState.resumed)) {
      connectionState = 'reconnect';
      _webSocketConnection.reconnect();
      listenStream();
      _webSocketConnection.register();
    }
    print('State: $state - Connection State: $connectionState');
    return Scaffold(
      drawer: UserDrawer(
        seeIntroduction: () {
          widget.setAppState('presentation');
        },
        resetAccount: () async {
          print('Reset Account');
          await NotificationHandler().putToken('');
          User.me.reset();
          Group.main.reset();
          await NotificationHandler().init();
          widget.setAppState('presentation');
        },
      ),
      appBar: AppBar(
          leading: Builder(
            builder: (BuildContext context) {
              return InkWell(
                onTap: () {
                  Scaffold.of(context).openDrawer();
                },
                child: Padding(
                  padding: const EdgeInsets.all(2),
                  child: CircleAvatar(
                    backgroundColor: Colors.transparent,
                    backgroundImage: NetworkImage(
                        'https://avatars.dicebear.com/api/bottts/${User.me.id}.png'),
                  ),
                ),
              );
            },
          ),
          centerTitle: true,
          title: UsersList(users: Group.main.users),
          actions: <Widget>[
            IconButton(
                tooltip: 'Changer de groupe',
                onPressed: state == 'chat'
                    ? () {
                        _webSocketConnection.switchgroup();
                        setState(() {
                          state = 'switch';
                        });
                      }
                    : null,
                icon: const Icon(Icons.door_front_door_outlined)),
          ]),
      body: Builder(
        builder: (BuildContext context) {
          late Widget child;
          switch (state) {
            case 'idle':
              child = const Loader();
              break;
            case 'switch':
              child = const Loader();
              break;
            case 'switchwaiting':
              child = const SwitchGroupPage();
              break;
            case 'chat':
              child = CustomChat(
                  messages: _messages,
                  onSendPressed: sendMessage,
                  onMessageLongPress: reportMessage);
              break;
            default:
              // TODO: error should re-ask server for current group if any
              // NOTE: here it tries to infer the correct state of the app
              child = ErrorPage(
                refresh: () async {
                  print('Try to restore connection');
                  _webSocketConnection.close();
                  _webSocketConnection.reconnect();
                  listenStream();
                  _webSocketConnection.register();
                  if (Group.main.id != '') {
                    setState(() {
                      state = 'chat';
                    });
                  } else {
                    setState(() {
                      state = 'idle';
                    });
                  }
                },
              );
          }
          switch (connectionState) {
            case 'disconnected':
              return Stack(
                children: [
                  child,
                  const Glass(),
                ],
              );
            case 'reconnect':
              // TODO: create an action to retry if an error occurs or the network is not reachable
              return Stack(
                children: [
                  child,
                  const Glass(),
                  const Loader(),
                ],
              );
            default:
              return child;
          }
        },
      ),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState appLifecycleState) {
    print('App Lifecycle State > $appLifecycleState');
    setState(() {
      _notification = appLifecycleState;
    });

    if (appLifecycleState != AppLifecycleState.resumed) {
      _webSocketConnection.close();
    }
  }

  @override
  void dispose() {
    _webSocketConnection.close();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
