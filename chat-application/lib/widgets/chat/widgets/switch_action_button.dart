import 'package:flutter/material.dart';

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
          tooltip: 'Changer de groupe',
          onPressed: onPressed,
          icon: const Icon(Icons.door_front_door_outlined));
    } else {
      return const SizedBox.shrink();
    }
  }
}
