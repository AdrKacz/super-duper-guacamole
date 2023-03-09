import 'package:awachat/dialogs/change_group.dart';
import 'package:awachat/dialogs/message_actions.dart';
import 'package:awachat/helpers/decode_jwt.dart';
import 'package:awachat/network/http_connection.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/chat/process_event.dart';
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
  AppLifecycleState? _appLifecycleState;
  Status status = Status.idle;
  ConnectionStatus connectionStatus = ConnectionStatus.disconnected;

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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  Widget build(BuildContext context) {
    // see status.name and connectionStatus.name
    if (connectionStatus == ConnectionStatus.disconnected &&
        (_appLifecycleState == null ||
            _appLifecycleState == AppLifecycleState.resumed)) {
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
      _appLifecycleState = appLifecycleState;
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
