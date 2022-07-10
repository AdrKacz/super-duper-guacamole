import 'package:flutter_chat_ui/flutter_chat_ui.dart';

/// French l10n which extends [ChatL10n]
class ChatL10nFr extends ChatL10n {
  /// Creates Frnech l10n. Use this constructor if you want to
  /// override only a couple of properties, otherwise create a new class
  /// which extends [ChatL10n]
  const ChatL10nFr({
    String attachmentButtonAccessibilityLabel = 'Envoyer un fichier',
    String emptyChatPlaceholder =
        'Envoie un message pour lancer la conversation!',
    String fileButtonAccessibilityLabel = 'Fichier',
    String inputPlaceholder = 'Awa',
    String sendButtonAccessibilityLabel = 'Envoyer',
  }) : super(
          attachmentButtonAccessibilityLabel:
              attachmentButtonAccessibilityLabel,
          emptyChatPlaceholder: emptyChatPlaceholder,
          fileButtonAccessibilityLabel: fileButtonAccessibilityLabel,
          inputPlaceholder: inputPlaceholder,
          sendButtonAccessibilityLabel: sendButtonAccessibilityLabel,
        );
}
