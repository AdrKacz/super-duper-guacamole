import 'package:awachat/widgets/chat/main.dart';
import 'package:awachat/widgets/chat/widgets/error.dart';
import 'package:awachat/widgets/chat/widgets/flyer_chat.dart';
import 'package:awachat/widgets/chat/widgets/glass.dart';
import 'package:awachat/widgets/chat/widgets/switch_group.dart';
import 'package:awachat/widgets/loader.dart';
import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;

class ChatPage extends StatelessWidget {
  const ChatPage(
      {Key? key,
      required this.messages,
      required this.status,
      required this.connectionStatus,
      required this.onSendMessage,
      required this.onReportMessage,
      required this.onRefresh})
      : super(key: key);

  final Status status;
  final ConnectionStatus connectionStatus;

  final dynamic Function(types.PartialText) onSendMessage;
  final void Function(BuildContext, types.Message) onReportMessage;
  final void Function() onRefresh;

  final List<types.Message> messages;

  @override
  Widget build(BuildContext context) {
    return Builder(
      builder: (BuildContext context) {
        late Widget child;
        switch (status) {
          case Status.idle:
            child = const Loader();
            break;
          case Status.switchSent:
            child = const SwitchGroupPage();
            break;
          case Status.chatting:
            child = FlyerChat(
                messages: messages,
                onSendPressed: onSendMessage,
                onMessageLongPress: onReportMessage);
            break;
          default:
            child = ErrorPage(
              refresh: onRefresh,
            );
        }
        switch (connectionStatus) {
          case ConnectionStatus.disconnected:
            return Stack(
              children: [
                child,
                const Glass(),
              ],
            );
          case ConnectionStatus.reconnecting:
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
    );
  }
}
