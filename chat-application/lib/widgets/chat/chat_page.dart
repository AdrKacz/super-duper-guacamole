import 'package:awachat/message.dart';
import 'package:awachat/network/http_connection.dart';
import 'package:awachat/widgets/chat/main.dart';
import 'package:awachat/widgets/chat/widgets/error.dart';
import 'package:awachat/widgets/chat/widgets/flyer_chat.dart';
import 'package:awachat/widgets/chat/widgets/glass.dart';
import 'package:awachat/widgets/chat/widgets/switch_group.dart';
import 'package:awachat/widgets/loader.dart';
import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;

import 'package:awachat/store/memory.dart';
import 'package:hive_flutter/hive_flutter.dart';

class ChatPage extends StatelessWidget {
  const ChatPage(
      {Key? key,
      required this.status,
      required this.connectionStatus,
      required this.onReportMessage,
      required this.onRefresh})
      : super(key: key);

  final Status status;
  final ConnectionStatus connectionStatus;

  final void Function(BuildContext, types.Message) onReportMessage;
  final void Function() onRefresh;

  void sendMessage(types.PartialText partialText) {
    final int createdAt = DateTime.now().millisecondsSinceEpoch;
    final String encodedMessage = encodeMessage(
        text: partialText.text,
        status: types.Status.sending,
        createdAt: createdAt);

    HttpConnection()
        .post(path: 'text-message', body: {'message': encodedMessage});
    Memory().boxMessages.put(createdAt.toString(), encodedMessage);
  }

  @override
  Widget build(BuildContext context) {
    print('status ${status.name}, connection status ${connectionStatus.name}');
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
            child = ValueListenableBuilder(
                valueListenable: Hive.box<String>(Memory.messages).listenable(),
                builder: (BuildContext context, Box box, widget) {
                  // Store object in a more convenient way
                  List<types.Message> messages = [];
                  for (final String jsonMessage in box.values) {
                    try {
                      messages.add(decodeMessage(jsonMessage));
                    } catch (e) {
                      print('chat page error: $e');
                    }
                  }

                  return FlyerChat(
                      messages: messages,
                      onSendPressed: sendMessage,
                      onMessageLongPress: onReportMessage);
                });

            break;
          case Status.error:
            child = ErrorPage(
              refresh: onRefresh,
            );
            break;
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
