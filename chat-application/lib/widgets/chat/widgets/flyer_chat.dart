import 'package:awachat/l10n/flyer_l10n.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/chat/widgets/flyer_user_avatar.dart';
import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_chat_ui/flutter_chat_ui.dart';

class FlyerChat extends StatelessWidget {
  const FlyerChat(
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
        avatarBuilder: (String userId) => FlyerUserAvatar(userId: userId),
        showUserNames: true,
        showUserAvatars: true,
        textMessageOptions: const TextMessageOptions(isTextSelectable: false),
        l10n: const ChatL10nFr(),
        messages: messages,
        onSendPressed: onSendPressed,
        onMessageLongPress: onMessageLongPress,
        user: types.User(id: User().id!),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        theme: DefaultChatTheme(
            primaryColor: Theme.of(context).colorScheme.onPrimary,
            inputBackgroundColor: Theme.of(context).colorScheme.primary,
            inputTextColor: Theme.of(context).colorScheme.onBackground,
            inputTextCursorColor: Theme.of(context).disabledColor));
  }
}
