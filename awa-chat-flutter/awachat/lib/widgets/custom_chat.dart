import 'package:awachat/flyer/l10n.dart';
import 'package:awachat/objects/user.dart';
import 'package:flutter/material.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_chat_ui/flutter_chat_ui.dart';

class CustomChat extends StatelessWidget {
  const CustomChat(
      {Key? key,
      required this.messages,
      required this.onSendPressed,
      required this.onMessageLongPress})
      : super(key: key);

  final List<types.Message> messages;
  final Function(types.PartialText) onSendPressed;
  final void Function(BuildContext, types.Message)? onMessageLongPress;

  @override
  Widget build(BuildContext context) {
    return Chat(
      showUserNames: true,
      showUserAvatars: true,
      isTextMessageTextSelectable: false,
      l10n: const ChatL10nFr(),
      messages: messages,
      onSendPressed: onSendPressed,
      onMessageLongPress: onMessageLongPress,
      user: types.User(id: User().id),
      theme: const DefaultChatTheme(
          inputBackgroundColor: Color(0xfff5f5f7),
          inputTextColor: Color(0xff1f1c38),
          inputTextCursorColor: Color(0xff9e9cab)),
    );
  }
}
