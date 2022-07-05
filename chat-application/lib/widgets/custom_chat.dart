import 'package:awachat/flyer/l10n.dart';
import 'package:awachat/store/user/user.dart';
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
      user: types.User(id: User.me.id),
      theme: DefaultChatTheme(
          primaryColor: Theme.of(context).colorScheme.onPrimary,
          inputBackgroundColor: Theme.of(context).colorScheme.secondary,
          inputTextColor: Theme.of(context).colorScheme.onSecondary,
          inputTextCursorColor: Theme.of(context).disabledColor),
    );
  }
}
