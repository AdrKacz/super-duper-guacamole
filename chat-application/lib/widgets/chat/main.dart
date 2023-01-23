import 'dart:convert';
import 'package:awachat/helpers/decode_jwt.dart';
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
import 'package:awachat/widgets/chat/chat_page.dart';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

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

    if (banneduserid == User().id && status == 'confirmed') {
      changeGroup();
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
        HttpConnection().put(path: 'reply-ban', body: {
          'bannedid': message.author.id,
          'status': 'confirmed',
        });
        break;
      case 'denied':
        // ban denied
        HttpConnection().put(path: 'reply-ban', body: {
          'bannedid': message.author.id,
          'status': 'denied',
        });
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
        HttpConnection().put(path: 'request-ban', body: {
          'bannedid': message.author.id,
          'messageid': message.id,
        });
        break;
      case 'report':
        await mailToReportTextMessage(
            types.TextMessage.fromJson(message.toJson()));
        break;
      case 'delete':
        Memory().boxMessages.delete(message.createdAt);
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
    for (final String e in Memory().boxMessages.values) {
      final types.Message m = decodeMessage(e);
      if (m.id == messageid) {
        return m;
      }
    }
    return null;
  }

  void blockUser(String userId) async {
    await Memory().boxBlockedUsers.add(userId);
    changeGroup();
  }

  Future<void> changeGroup() async {
    await User().resetGroup();

    HttpConnection().post(path: 'change-group', body: {
      'questions': Memory().boxAnswers.toMap(),
      'blockedUserIds': Memory().boxBlockedUsers.values.toList()
    });

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
      User().updateGroupId(userStatus['group']['id']);
    }

    final Map<String, Map<dynamic, dynamic>> groupUsers = {};
    for (final groupUser in userStatus['users']) {
      groupUsers[groupUser['id']] = {
        'id': groupUser['id'],
        'isConnected': groupUser['isConnected']
      };
    }
    await updateGroupUsers(groupUsers);

    setState(() {
      // update status
      status = Status.chatting;
      connectionStatus = ConnectionStatus.connected;
    });
  }

  Future<void> updateGroupUsers(
      Map<String, Map<dynamic, dynamic>> groupUsers) async {
    // update users
    final Map<dynamic, Map> oldGroupUsers = Memory().boxGroupUsers.toMap();
    await User().updateGroupUsers(groupUsers);

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
      case 'share-profile':
        messageShareProfile(data);
        break;
      case 'ban-request':
        banRequest(context, data['messageid']);
        break;
      case 'ban-reply':
        acknowledgeBan(context, data['status'], data['bannedid']);
        break;
      case 'connect':
        User().updateGroupUserStatus(data['id'], true);
        break;
      case 'disconnect':
        User().updateGroupUserStatus(data['id'], false);
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
            await HttpConnection()
                .put(path: 'firebase-token', body: {'token': ''});
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
                  onPressed: changeGroup),
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
