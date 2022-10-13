import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class SwitchActionButton extends StatelessWidget {
  const SwitchActionButton(
      {Key? key, required this.isChatting, required this.onPressed})
      : super(key: key);

  final bool isChatting;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) {
    if (isChatting) {
      return IconButton(
          tooltip: AppLocalizations.of(context)!.changeGroup,
          onPressed: onPressed,
          icon: const Icon(Icons.door_front_door_outlined));
    } else {
      return const SizedBox.shrink();
    }
  }
}
