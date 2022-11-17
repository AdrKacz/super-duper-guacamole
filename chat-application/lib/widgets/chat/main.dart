import 'dart:collection';
import 'dart:convert';
import 'package:awachat/message.dart';
import 'package:awachat/network/http_connection.dart';
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

enum Status { idle, switchSent, chatting, error }

enum ConnectionStatus { connected, disconnected, reconnecting }

class ChatHandler extends StatefulWidget {
  const ChatHandler({Key? key, required this.goToPresentation})
      : super(key: key);

  final Function goToPresentation;

  @override
  State<ChatHandler> createState() => _ChatHandlerState();
}

class _ChatHandlerState extends State<ChatHandler> with WidgetsBindingObserver {
  // ===== ===== =====
  // App state (lifecycle)
  AppLifecycleState? _notification;

  // Channel
  final WebSocketConnection _webSocketConnection = WebSocketConnection();

  void listenMessage(message) {
    // receive message
    print('received message: $message');
    processMessage(message);
  }

  void initConnection() {
    _webSocketConnection.connect();
    setState(() {
      connectionStatus = ConnectionStatus.connected;
    });
    _webSocketConnection.stream.listen(listenMessage, onDone: () {
      if (mounted) {
        setState(() {
          connectionStatus = ConnectionStatus.disconnected;
        });
      }
    }, cancelOnError: true);
    _webSocketConnection.register();
  }

  // ===== ===== =====
  // Chat Messages
  final SplayTreeMap<int, types.Message> _messages = SplayTreeMap(
      (key1, key2) => key2 - key1); // createdAt is the (sorting) key

  // ===== ===== =====
  // Status
  Status status = Status.idle;

  ConnectionStatus connectionStatus = ConnectionStatus.disconnected;

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
      // message (messageId) wasn't found
      return;
    }
    // found message

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
      default:
      // dismiss
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
    changeGroup();
    setState(() {
      status = Status.switchSent;
    });
  }

  Future<Map> changeGroup() async {
    await User().resetGroup();
    return HttpConnection().post(path: 'change-group', body: {
      'questions': Memory().boxAnswers.toMap(),
      'blockedUsers': Memory().getBlockedUsers()
    });
  }

  // ===== ===== =====
  // Process message
  void messageLogin(data) {
    User().updateGroupUserStatus(data['id'], true);
  }

  void messageLogout(data) {
    User().updateGroupUserStatus(data['id'], false);
  }

  Future<void> updateStatus({List<dynamic> unreadData = const []}) async {
    print('Update Status');
    Map userStatus = await HttpConnection().get(path: 'status');

    if (userStatus['group'] == null) {
      print('group is null');
      // you don't have a group and didn't ask for
      await User().resetGroup();
      changeGroup();
      setState(() {
        status = Status.switchSent;
      });
      return;
    }

    if (userStatus['group']['isPublic'] == false) {
      print('group is private');
      // you ask for a group but it has not opened yet
      await User().resetGroup();
      setState(() {
        status = Status.switchSent;
      });
      return;
    }
    print('group is public');

    // you have a group and can start chatting

    // update group if necessary
    if (userStatus['group']['id'] != User().groupId) {
      // doesn't have the correct group
      User().updateGroupId(userStatus['group']['id']);
      _messages.clear();
    }

    final Map<String, Map<dynamic, dynamic>> groupUsers = {};
    for (final groupUser in userStatus['users']) {
      groupUsers[groupUser['id']] = {
        'id': groupUser['id'],
        'isConnected': groupUser['isConnected']
      };
    }
    updateGroupUsers(groupUsers);

    // process unread data
    for (final data in unreadData) {
      processMessage(jsonEncode(data), isUnreadData: true);
    }

    setState(() {
      // update status
      status = Status.chatting;
      connectionStatus = ConnectionStatus.connected;
    });
  }

  void updateGroupUsers(Map<String, Map<dynamic, dynamic>> groupUsers) {
    // update users
    final Map<dynamic, Map> oldGroupUsers = Memory().boxGroupUsers.toMap();
    User().updateGroupUsers(groupUsers);

    // is profile already shared?
    if (Memory().boxUser.get('hasSharedProfile') != 'true') {
      return;
    }

    // has different users?
    for (final String userId in oldGroupUsers.keys) {
      groupUsers.remove(userId);
    }

    if (groupUsers.isEmpty) {
      // different users
      return;
    }

    showDialog(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: groupUsers.length > 1
            ? const Text('De nouveaux utilisateurs rejoignent le groupe')
            : const Text('Un nouvel utilisateur rejoins le groupe'),
        content: groupUsers.length > 1
            ? const Text(
                'Les nouveaux utilisateurs ne peuvent pas voir la photo que tu as déjà partagé.')
            : const Text(
                'Le nouvel utilisateur ne peux pas voir la photo que tu as déjà partagé.'),
        actions: [
          TextButton(
            child: const Text('Re-partager ma photo'),
            onPressed: () {
              Navigator.of(context).pop('share-profile');
            },
          ),
          TextButton(
            child: const Text('Ok'),
            onPressed: () {
              Navigator.of(context).pop();
            },
          )
        ],
      ),
    ).then((value) async {
      if (value == 'share-profile') {
        await User().shareProfile(context);
        setState(() {});
      }
    });
  }

  bool messageShareProfile(data) {
    final String? userId = data['user'];

    if (userId == null) {
      return false;
    }

    if (userId == User().id) {
      return false; // don't do anything
    }

    final Map profile = data['profile'];

    final Uint8List picture =
        Uint8List.fromList(List<int>.from(profile['picture']));

    Memory().boxUserProfiles.put(userId, {'picture': picture});
    User().updateGroupUserArgument(userId, 'receivedProfile', true);

    showDialog<String?>(
        context: context,
        builder: (BuildContext context) {
          return AlertDialog(
              title: CircleAvatar(
                backgroundColor: Colors.transparent,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(50.0),
                  child: User.getUserImage(userId),
                ),
              ),
              content: const Text("Quelqu'un partage son identité !"),
              actions: [
                TextButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                    },
                    child: const Text('Ok')),
                TextButton(
                    onPressed: () {
                      Navigator.of(context).pop('share-profile');
                    },
                    child: const Text('Je partage aussi mon profil !')),
                TextButton(
                    onPressed: () {
                      Navigator.of(context).pop('report');
                    },
                    child: Text('Je signale la photo',
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.onSecondary))),
              ]);
        }).then((value) {
      if (value == 'share-profile') {
        User().shareProfile(context).then((value) => {setState(() {})});
      } else if (value == 'report') {
        mailToReportPhoto(userId).then((value) => {setState(() {})});
      }
    });

    return true;
  }

  void messageTextMessage(data) {
    try {
      final types.TextMessage message = decodeMessage(data['message']);
      final String encodedMessage = encodeMessage(
          text: message.text,
          status: types.Status.delivered,
          author: message.author.id,
          createdAt: message.createdAt,
          id: message.id);
      Memory().boxMessages.put(message.createdAt.toString(), encodedMessage);

      if (!data['_isUnreadData']) {
        HapticFeedback.lightImpact();
      }
    } catch (e) {
      print('message text message error: $e');
    }
  }

  void messageBanRequest(data) {
    banRequest(context, data['messageid']);
  }

  void messageBanReply(data) {
    acknowledgeBan(context, data['status'], data['bannedid']);
  }

  void processMessage(message, {bool isUnreadData = false}) {
    // process message
    final data = jsonDecode(message);

    data['_isUnreadData'] = isUnreadData;

    switch (data['action']) {
      case 'register':
        if (!isUnreadData) {
          updateStatus(unreadData: data['unreadData']);
        }
        break;
      case 'leavegroup':
      case 'joingroup':
      case 'status-update':
        updateStatus();
        break;
      case 'textmessage':
        messageTextMessage(data);
        break;
      case 'shareprofile':
        messageShareProfile(data);
        break;
      case 'banrequest':
        messageBanRequest(data);
        break;
      case 'banreply':
        messageBanReply(data);
        break;
      case 'login':
        if (!isUnreadData) {
          messageLogin(data);
        }
        break;
      case 'logout':
        if (!isUnreadData) {
          messageLogout(data);
        }
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
        drawer: UserDrawer(
          update: () {
            setState(() {});
          },
          seeIntroduction: () {
            widget.goToPresentation();
          },
          resetAccount: () async {
            // reset account
            widget.goToPresentation();
            await HttpConnection().legacyPut('firebase-token', {'token': ''});
            await User().resetUser();
            NotificationHandler().init();
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
                      backgroundImage: User.getUserImageProvider(User().id),
                    ),
                  ),
                );
              },
            ),
            centerTitle: true,
            title: const UsersList(),
            actions: <Widget>[
              SwitchActionButton(
                  isChatting: status == Status.chatting,
                  onPressed: (() {
                    changeGroup();
                    setState(() {
                      status = Status.switchSent;
                    });
                  })),
            ]),
        body: ChatPage(
            status: status,
            connectionStatus: connectionStatus,
            onReportMessage: reportMessage,
            onRefresh: () {
              _webSocketConnection.close();
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
