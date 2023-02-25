import 'package:awachat/l10n/flyer_l10n.dart';
import 'package:awachat/store/group_user.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/chat/widgets/flyer_user_avatar.dart';
import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:flutter_chat_ui/flutter_chat_ui.dart';

class FlyerChat extends StatefulWidget {
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
  State<FlyerChat> createState() => _FlyerChatState();
}

class _FlyerChatState extends State<FlyerChat> {
  final InputTextFieldController _controller = InputTextFieldController();

  @override
  void initState() {
    super.initState();
    _controller.text = Memory().boxUser.get('typingMessage') ?? '';
  }

  @override
  Widget build(BuildContext context) {
    return Chat(
        avatarBuilder: (String userId) => FlyerUserAvatar(userId: userId),
        showUserNames: true,
        showUserAvatars: true,
        textMessageOptions: const TextMessageOptions(isTextSelectable: false),
        l10n: const ChatL10nFr(),
        messages: widget.messages,
        onSendPressed: (types.PartialText text) {
          widget.onSendPressed(text);
          Memory().boxUser.delete('typingMessage');
        },
        onMessageLongPress: widget.onMessageLongPress,
        user: GroupUser(User().id!).flyerUser,
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        inputOptions: InputOptions(
            textEditingController: _controller,
            onTextChanged: (String text) {
              Memory().boxUser.put('typingMessage', text);
            }),
        theme: DefaultChatTheme(
            primaryColor: Theme.of(context).colorScheme.onPrimary,
            inputBackgroundColor: Theme.of(context).colorScheme.primary,
            inputTextColor: Theme.of(context).colorScheme.onBackground,
            inputTextCursorColor: Theme.of(context).disabledColor));
  }
}
