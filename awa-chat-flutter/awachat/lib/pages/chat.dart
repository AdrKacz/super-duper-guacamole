import 'package:flutter/material.dart';

import 'package:awachat/memory.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_chat_ui/flutter_chat_ui.dart';
import 'package:awachat/message.dart';
import 'package:awachat/room.dart';
import 'package:awachat/user.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({Key? key, required this.stream}) : super(key: key);

  final Stream<dynamic> stream;

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  late Future<List<types.Message>> memoryMessages;

  @override
  Widget build(BuildContext context) {
    print("BUILD CHAT");
    // Load messages from memory if any
    memoryMessages = Memory().loadMessages();
    return FutureBuilder(
        future: memoryMessages,
        builder: (BuildContext context,
            AsyncSnapshot<List<types.Message>> snapshotMemoryMessages) {
          if (snapshotMemoryMessages.hasData) {
            final List<types.Message> messages =
                snapshotMemoryMessages.data ?? [];

            // Listen to incomming stream of messages
            return StreamBuilder<dynamic>(
                stream: widget.stream,
                builder:
                    (BuildContext context, AsyncSnapshot<dynamic> snapshot) {
                  if (snapshot.hasData) {
                    types.Message? message = messageFrom(snapshot.data);
                    if (message != null) {
                      messages.insert(0, message);
                      Memory().addMessage(snapshot.data);
                    }
                  }

                  return Chat(
                    messages: messages,
                    onSendPressed: Room().sendMessage,
                    user: User().user,
                    theme: const DefaultChatTheme(
                        inputBackgroundColor: Color(0xfff5f5f7),
                        inputTextColor: Color(0xff1f1c38),
                        inputTextCursorColor: Color(0xff9e9cab)),
                  );
                });
          } else if (snapshotMemoryMessages.hasError) {
            return const Center(
                child: CircularProgressIndicator(
                    color: Color.fromARGB(255, 232, 97, 126)));
          }
          return const Center(
              child: CircularProgressIndicator(
                  color: Color.fromARGB(255, 129, 232, 97)));
        });
  }
}
