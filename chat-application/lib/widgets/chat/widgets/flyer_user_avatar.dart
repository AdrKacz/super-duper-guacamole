import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/avatar.dart';
import 'package:flutter/material.dart';

/// Renders user's avatar or initials next to a message
class FlyerUserAvatar extends StatelessWidget {
  /// Creates user avatar
  const FlyerUserAvatar({
    super.key,
    required this.userId,
    this.onAvatarTap,
  });

  /// Author to show image and name initials from
  final String userId;

  /// Called when user taps on an avatar
  final void Function(String)? onAvatarTap;

  @override
  Widget build(BuildContext context) {
    return Container(
        margin: const EdgeInsetsDirectional.only(end: 8.0),
        child: Avatar(userId: userId, radius: 16));
  }
}
