import 'dart:convert';
import 'package:awachat/dialogs/change_group.dart';
import 'package:awachat/dialogs/message_actions.dart';
import 'package:awachat/dialogs/user_actions.dart';
import 'package:awachat/helpers/decode_jwt.dart';
import 'package:awachat/message.dart';
import 'package:awachat/network/http_connection.dart';
import 'package:awachat/store/group_user.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/chat/widgets/switch_action_button.dart';
import 'package:awachat/widgets/chat/widgets/user_drawer.dart';
import 'package:awachat/widgets/chat/widgets/users_list.dart';
import 'package:flutter/services.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/widgets/chat/chat_page.dart';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

enum Status { idle, switchSent, chatting, error }

enum ConnectionStatus { connected, disconnected, reconnecting }

class ChatHandler extends StatefulWidget {
  const ChatHandler({Key? key}) : super(key: key);

  @override
  State<ChatHandler> createState() => _ChatHandlerState();
}

class _ChatHandlerState extends State<ChatHandler> with WidgetsBindingObserver {
  // ===== ===== =====
  // App state (lifecycle)
  AppLifecycleState? _notification;

  WebSocketChannel? _channel;
  Future<void> initConnection() async {
    if (isTokenExpired(Memory().boxUser.get('jwt') ?? '')) {
      await HttpConnection().signIn();
    }

    _channel = WebSocketChannel.connect(Uri.parse(
        '${const String.fromEnvironment('WEBSOCKET_ENDPOINT')}?token=${Memory().boxUser.get('jwt')}'));

    setState(() {
      connectionStatus = ConnectionStatus.connected;
    });

    _channel!.stream
        .listen(((event) => (processEvent(event, isUnreadData: false))),
            onError: (error) {
      print('channel stream error $error');
      _channel?.sink.close();
    }, onDone: () {
      if (mounted) {
        setState(() {
          connectionStatus = ConnectionStatus.disconnected;
        });
      }
    }, cancelOnError: true);

    await updateStatus();
    await processUnreadData();
  }

  // ===== ===== =====
  // Status
  Status status = Status.idle;

  ConnectionStatus connectionStatus = ConnectionStatus.disconnected;

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

    // TODO: how to display name of ban user? As it will be remove from box because they will leave group

    if (banneduserid == User().id && status == 'confirmed') {
      changeGroup();
      showDialog(
          context: context,
          builder: (BuildContext context) {
            return AlertDialog(
              title: const Text('Tu es bani du groupe'),
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
        title = 'Un utilisateur est bani du groupe';
        actions.insert(
            0,
            TextButton(
              child: const Text('Supprimer tous ses messages'),
              onPressed: () {
                final List<String> messageKeysToDelete = [];
                for (final String k in Memory().boxMessages.keys) {
                  final types.TextMessage m =
                      decodeMessage(Memory().boxMessages.get(k)!);
                  if (m.author.id == banneduserid) {
                    messageKeysToDelete.add(k);
                  }
                }
                Memory().boxMessages.deleteAll(messageKeysToDelete);

                Navigator.of(context).pop();
              },
            ));

        break;
      case 'denied':
        title = '''L'utilisateur n'est pas bani du groupe''';
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
  void banRequest(BuildContext context, String userId) async {
    // verify user is in group
    if (!Memory().boxGroupUsers.containsKey(userId)) {
      print('user $userId is not in your group');
      return;
    }

    HapticFeedback.mediumImpact();
    dialogBanUserActions(context, userId);
  }

  // Report message
  void reportMessage(BuildContext context, types.Message message) async {
    HapticFeedback.mediumImpact();
    final String? action = await dialogMessageActions(context, message);

    if (action == 'block') {
      setState(() {
        status = Status.switchSent;
      });
    }
  }

  // ===== ===== =====
  // Helpers
  Future<void> pressedChangeGroup() async {
    final bool isConfirmed = (await dialogChangeGroup(context)) ?? false;

    if (isConfirmed) {
      await changeGroup();
    }
  }

  Future<void> changeGroup() async {
    await User().changeGroup();

    setState(() {
      status = Status.switchSent;
    });
  }

  Future<void> processUnreadData() async {
    Map data = await HttpConnection().get(path: 'unread-data');

    for (final data in data['unreadData'] ?? []) {
      // TODO: make sure you don't refresh screen thousand times here
      processEvent(jsonEncode(data), isUnreadData: true);
    }

    await HttpConnection().delete(path: 'unread-data', body: {});
  }

  // ===== ===== =====
  // Process message
  Future<void> updateStatus() async {
    Map userStatus = await HttpConnection().get(path: 'status');

    if (userStatus.isEmpty || userStatus['id'] != User().id) {
      setState(() {
        status = Status.error;
      });
      return;
    }

    if (userStatus['group'] == null) {
      // you don't have a group and didn't ask for
      changeGroup();
      return;
    }

    if (userStatus['group']['isPublic'] == false) {
      // you ask for a group but it has not opened yet
      await User().resetGroup();
      setState(() {
        status = Status.switchSent;
      });
      return;
    }
    // you have a group and can start chatting

    // update group if necessary
    if (userStatus['group']['id'] != User().groupId) {
      // doesn't have the correct group
      await User().updateGroupId(userStatus['group']['id']);
    }

    final Map<String, Map> groupUsers = {};
    for (final groupUser in userStatus['users']) {
      groupUsers[groupUser['id']] = {
        'id': groupUser['id'],
        'isConnected': groupUser['isConnected']
      };
    }
    User().updateGroupUsers(groupUsers);

    setState(() {
      // update status
      status = Status.chatting;
      connectionStatus = ConnectionStatus.connected;
    });
  }

  void messageTextMessage(data, {required bool isUnreadData}) {
    try {
      final types.TextMessage message = decodeMessage(data['message']);
      final String encodedMessage = encodeMessage(
          text: message.text,
          status: types.Status.delivered,
          author: message.author.id,
          createdAt: message.createdAt,
          id: message.id);
      Memory().boxMessages.put(message.createdAt.toString(), encodedMessage);

      if (!isUnreadData) {
        HapticFeedback.lightImpact();
      }
    } catch (e) {
      print('message text message error: $e');
    }
  }

  void processEvent(message, {required bool isUnreadData}) {
    print('process message (unread data $isUnreadData) $message');
    // process message
    final data = jsonDecode(message);

    switch (data['action']) {
      case 'update-status':
        updateStatus();
        break;
      case 'text-message':
        messageTextMessage(data, isUnreadData: isUnreadData);
        break;
      case 'ban-request':
        banRequest(context, data['id']);
        break;
      case 'ban-reply':
        acknowledgeBan(context, data['status'], data['bannedid']);
        break;
      case 'connect':
        GroupUser(data['id']).updateStatus(true);
        break;
      case 'disconnect':
        GroupUser(data['id']).updateStatus(false);
        break;
      default:
        print('received unknown action $data');
      // NOTE: do you want to add error on screen here?
      // NOTE: it could be a 'Internal server error' or other
    }
  }

  // ===== ===== =====
  // Widget lifecycle

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  Widget build(BuildContext context) {
    // see status.name and connectionStatus.name
    if (connectionStatus == ConnectionStatus.disconnected &&
        (_notification == null || _notification == AppLifecycleState.resumed)) {
      connectionStatus = ConnectionStatus.reconnecting;
      initConnection();
    }

    return Scaffold(
        drawer: const UserDrawer(),
        appBar: AppBar(
            leading: Builder(
                builder: (BuildContext context) => (IconButton(
                    icon: const Icon(Icons.menu),
                    onPressed: () => (Scaffold.of(context).openDrawer())))),
            centerTitle: true,
            title: const UsersList(),
            actions: <Widget>[
              SwitchActionButton(
                  isChatting: status == Status.chatting,
                  onPressed: pressedChangeGroup)
            ]),
        body: ChatPage(
            status: status,
            connectionStatus: connectionStatus,
            onReportMessage: reportMessage,
            onRefresh: () {
              _channel?.sink.close();
              initConnection();
              setState(() {
                status = Status.idle;
              });
            }));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState appLifecycleState) {
    setState(() {
      _notification = appLifecycleState;
    });

    if (appLifecycleState != AppLifecycleState.resumed) {
      _channel?.sink.close();
    }
  }

  @override
  void dispose() {
    _channel?.sink.close();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
