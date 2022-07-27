import 'dart:collection';
import 'dart:convert';
import 'dart:developer';
import 'package:awachat/message.dart';
import 'package:awachat/network/notification_handler.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/chat/widgets/switch_action_button.dart';
import 'package:awachat/widgets/chat/widgets/user_drawer.dart';
import 'package:awachat/widgets/chat/widgets/users_list.dart';
import 'package:flutter/services.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/network/web_socket_connection.dart';
import 'package:awachat/widgets/chat/chat_page.dart';
import 'package:flutter/material.dart';

import 'widgets/fake_chat.dart';

enum Status { idle, switchSent, chatting, other }

enum ConnectionStatus { connected, disconnected, reconnecting }

class ChatHandler extends StatefulWidget {
  const ChatHandler({Key? key, required this.goToPresentation})
      : super(key: key);

  final Function goToPresentation;

  @override
  State<ChatHandler> createState() => _ChatHandlerState();
}

class _ChatHandlerState extends State<ChatHandler> with WidgetsBindingObserver {
  // Pointer
  bool _isPointerUp =
      false; // set default to "you touch the screen" to not change page by error

  bool _isChangePageLock = false;

  // Messages Actions
  late final Map<String, Function> messageActions;

  // ===== ===== =====
  // App state (lifecycle)
  AppLifecycleState? _notification;

  // Channel
  final WebSocketConnection _webSocketConnection = WebSocketConnection();

  void listenMessage(message) {
    // receive message
    if (processMessage(message)) {
      setState(() {});
    }
  }

  void listenStream() {
    _webSocketConnection.stream.listen(listenMessage, onDone: () {
      if (mounted) {
        setState(() {
          connectionStatus = ConnectionStatus.disconnected;
        });
      }
    }, cancelOnError: true);
  }

  // ===== ===== =====
  // Chat Messages
  final SplayTreeMap<int, types.Message> _messages = SplayTreeMap(
      (key1, key2) => key2 - key1); // createdAt is the (sorting) key

  // ===== ===== =====
  // Status
  Status get status {
    String statusName =
        Memory().get('user', 'appChatState') ?? Status.idle.name;
    for (final Status value in Status.values) {
      if (statusName == value.name) {
        return value;
      }
    }
    return Status.other;
  }

  set status(Status newStatus) {
    Memory().put('user', 'appChatState', newStatus.name);
  }

  ConnectionStatus connectionStatus = ConnectionStatus.connected;

  // ===== ===== =====
  // Change Group Swipe
  List<String> items = <String>['real'];

  void _reverse() {
    setState(() {
      items = items.reversed.toList();
    });
  }

  // ===== ===== =====
  // Actions
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

    if (banneduserid == User().id && status == 'confirmed') {
      showDialog(
          context: context,
          builder: (BuildContext context) {
            return AlertDialog(
              title: const Text("Tu t'es fait banir de ton groupe"),
              actions: actions,
            );
          });
      return;
    }

    if (banneduserid == User().id) {
      return; // no need to alert the user
    }

    switch (status) {
      case 'confirmed':
        title = 'La personne est banie de ton groupe';
        actions.insert(
            0,
            TextButton(
              child: const Text('Supprimer tous ses messages'),
              onPressed: () {
                final List<types.Message> messagesToRemove = [];
                for (final types.Message e in _messages.values) {
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

        break;
      case 'denied':
        title = "La personne n'est pas banie de ton groupe";
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

  // Ban request
  void banRequest(BuildContext context, String messageid) async {
    // find message
    types.Message? message = findMessage(messageid);
    if (message == null) {
      // message was not found (see messageid)
      return;
    }

    HapticFeedback.mediumImpact();
    switch (await banActionOnMessage(context, message)) {
      case 'confirmed':
        // ban confirmed
        _webSocketConnection.banreply(message.author.id, 'confirmed');
        break;
      case 'denied':
        // ban denied
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
      case 'ban':
        _webSocketConnection.banrequest(message.author.id, message.id);
        break;
      case 'report':
        await mailToReportMessage(_messages.values.toList(), message);
        break;
      case 'delete':
        deleteMessage(message);
        break;
      case 'block':
        blockUser(message.author.id);
        break;
      // default: dismiss
    }
  }

  // ===== ===== =====
  // Helpers
  types.Message? findMessage(String messageid) {
    for (final types.Message message in _messages.values) {
      if (message.id == messageid) {
        return message;
      }
    }
    return null;
  }

  Future<void> loadMessagesFromMemory() async {
    final List<types.Message> loadedMessages = Memory().loadMessages();

    _messages.clear();
    for (final types.Message loadedMessage in loadedMessages) {
      insertMessage(loadedMessage, useHaptic: false);
    }
    setState(() {});
  }

  void deleteMessage(types.Message message) {
    // remove the message locally
    setState(() {
      _messages.remove(message);
    });
    // remove the message in memory
    Memory().deleteMessage(message.id);
  }

  void insertMessage(types.Message message, {bool useHaptic = true}) {
    if (useHaptic && message.status == types.Status.delivered) {
      HapticFeedback.lightImpact();
    }

    _messages[message.createdAt ?? 0] = message;
  }

  void blockUser(String userId) {
    Memory().addBlockedUser(userId);
    setState(() {
      switchGroup();
    });
  }

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

  void switchGroup() {
    // remove group locally
    User().groupId = '';
    // send switch group
    _webSocketConnection.switchgroup();
    items = ['real'];
    status = Status.switchSent;
  }

  // ===== ===== =====
  // Process message
  bool messageLogin(data) {
    User().updateOtherUserStatus(data['id'], true);
    return true;
  }

  bool messageLogout(data) {
    User().updateOtherUserStatus(data['id'], false);
    return true;
  }

  bool messageRegister(data) {
    // connection made
    // needUpdate cannot be false because connectionState changed
    connectionStatus = ConnectionStatus.connected;

    print(DateTime.now());
    print('process register');
    print('data group - ${data['group'] ?? ''}');
    print('user group - ${User().groupId}');
    print('status - ${status.name}');
    print('----- ----- -----');

    final String assignedGroupId = data['group'] ?? '';

    if (status == Status.switchSent && assignedGroupId == '') {
      // group not find yet
      // already switching group
      return true;
    }

    if (status != Status.switchSent && assignedGroupId == '') {
      // not asked for a group yet
      NotificationHandler().init();
      switchGroup();
      _messages.clear();

      return true;
    }

    // process unread messages (no need before, status update are not sent anymore)
    for (final unreadMessage in data['unreadData']) {
      processMessage(jsonEncode(unreadMessage), isInnerLoop: true);
    }

    // Below, assignedGroupId is not empty
    status = Status.chatting;
    if (!items.contains('fake')) {
      items = ['real', 'fake'];
    }

    if (assignedGroupId != User().groupId) {
      // doesn't have the correct group
      User().groupId = assignedGroupId;
      _messages.clear();
    }

    // convert assignedGroupUsers to correct type
    final Map<String, dynamic> users = {};
    for (final user in data['groupUsers'] ?? []) {
      if (user['id'] != null) {
        users[user['id'] ?? ''] = {
          'id': user['id'],
          'isActive': user['isOnline']
        };
      }
    }
    User().overrideOtherUsers(users);

    loadMessagesFromMemory();

    return true;
  }

  bool messageTextMessage(data) {
    // see message in data['message']
    types.Message? message = messageDecode(data['message']);
    if (message != null) {
      if (!data['_isInnerLoop']) {
        insertMessage(message);
      }
      Memory().addMessage(message.id, data['message']);
    }
    return true;
  }

  bool messageBanRequest(data) {
    // ban request for data['messageid']
    banRequest(context, data['messageid']);
    return false;
  }

  bool messageBanReply(data) {
    // ban reply for data['bannedid'] (see status in data['status'])
    acknowledgeBan(context, data['status'], data['bannedid']);
    return false;
  }

  bool processMessage(message, {bool isInnerLoop = false}) {
    final data = jsonDecode(message);

    print('process message');
    print(DateTime.now());
    print('action - ${data['action']}');
    print('----- ----- -----');

    data['_isInnerLoop'] = isInnerLoop;

    if (isInnerLoop &&
        ['login', 'logout', 'register'].contains(data['action'])) {
      // skip processing (not needed)
      return false;
    }
    if (messageActions.containsKey(data['action'])) {
      return messageActions[data['action']]!(data);
    } else {
      // action not recognised (see data['action'])
      return false;
    }
  }

  // ===== ===== =====
  // Widget lifecycle

  void changePage(PageController controller) {
    if (_isChangePageLock) {
      return;
    }

    if (!_isPointerUp) {
      // don't change page if you touch the screen
      return;
    }

    if (controller.page == null) {
      // should not happen, propably an error
      return;
    }

    if (controller.page! > 0.5) {
      // start to change page
      _isChangePageLock = true;
      //TODO: update the time so it fits the end of the animation
      Future.delayed(const Duration(milliseconds: 600), () {
        if (_isPointerUp && controller.page! > 0.5) {
          // need to recheck if user manually move the page during the delay
          // change page
          setState(() {
            // Swith Group
            switchGroup();
            // Change Page
            _reverse();
            controller.jumpToPage(0);
          });
        }
        _isChangePageLock = false;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _webSocketConnection.register();
    listenStream();

    messageActions = {
      'login': messageLogin,
      'logout': messageLogout,
      'register': messageRegister,
      'textmessage': messageTextMessage,
      'banrequest': messageBanRequest,
      'banreply': messageBanReply,
    };
  }

  @override
  Widget build(BuildContext context) {
    // see status in status.name and connectection status in connectionStatus.name
    final PageController controller = PageController();
    if (connectionStatus == ConnectionStatus.disconnected &&
        (_notification == null || _notification == AppLifecycleState.resumed)) {
      connectionStatus = ConnectionStatus.reconnecting;
      _webSocketConnection.reconnect();
      listenStream();
      _webSocketConnection.register();
    }

    return Scaffold(
      drawer: UserDrawer(
        seeIntroduction: () {
          widget.goToPresentation();
        },
        resetAccount: () async {
          // reset account
          await NotificationHandler().putToken('');
          User().clear();
          await Memory().clear();
          await User().init();
          await NotificationHandler().init();
          widget.goToPresentation();
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
                        'https://avatars.dicebear.com/api/bottts/${User().id}.png'),
                  ),
                ),
              );
            },
          ),
          centerTitle: true,
          title: UsersList(users: User().otherGroupUsers.values),
          actions: <Widget>[
            SwitchActionButton(
                isChatting: status == Status.chatting,
                onPressed: () {
                  setState(() {
                    switchGroup();
                  });
                }),
          ]),
      body: Listener(
        onPointerDown: (PointerDownEvent event) {
          _isPointerUp = false;
        },
        onPointerUp: (PointerUpEvent event) {
          _isPointerUp = true;
          changePage(controller);
        },
        child: PageView.builder(
            onPageChanged: (int index) {
              changePage(controller);
            },
            controller: controller,
            itemBuilder: (BuildContext context, int index) {
              if (index == 0) {
                // build chat
                return ChatPage(
                    key: Key(items[index]),
                    messages: _messages.values.toList(),
                    status: status,
                    connectionStatus: connectionStatus,
                    onSendMessage: sendMessage,
                    onReportMessage: reportMessage,
                    onRefresh: () async {
                      // TODO: error should re-ask server for current group if any
                      // NOTE: here it tries to infer the correct state of the app
                      // try to restore connection
                      _webSocketConnection.close();
                      _webSocketConnection.reconnect();
                      listenStream();
                      _webSocketConnection.register();
                      if (User().groupId != '') {
                        setState(() {
                          status = Status.chatting;
                        });
                      } else {
                        setState(() {
                          status = Status.idle;
                        });
                      }
                    });
              } else {
                // build fake chat
                return FakeChat(key: Key(items[index]));
              }
            },
            itemCount: items.length,
            findChildIndexCallback: (Key key) {
              final ValueKey<String> valueKey = key as ValueKey<String>;
              final String data = valueKey.value;
              return items.indexOf(data);
            }),
      ),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState appLifecycleState) {
    // see app lifecycle state in appLifecycleState
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
