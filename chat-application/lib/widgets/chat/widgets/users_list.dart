import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';
import 'package:badges/badges.dart';

class UsersList extends StatelessWidget {
  const UsersList({Key? key, required this.users}) : super(key: key);

  final Iterable<Map<dynamic, dynamic>> users;

  @override
  Widget build(BuildContext context) {
    if (users.isNotEmpty) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: users
            .map((user) => Stack(
                  alignment: AlignmentDirectional.center,
                  children: [
                    CircleAvatar(
                      backgroundColor: Colors.transparent,
                      backgroundImage: NetworkImage(
                          "https://avatars.dicebear.com/api/bottts/${user['id']}.png"),
                    ),
                    Badge(
                        showBadge: user['isActive'],
                        badgeColor: Theme.of(context).colorScheme.tertiary,
                        position: BadgePosition.bottomEnd(),
                        child: const SizedBox(
                          width: kToolbarHeight * .5,
                          height: kToolbarHeight * .5,
                        )),
                  ],
                ))
            .toList(),
      );
    } else {
      return Transform.scale(
        scale: 0.5,
        child: CircularProgressIndicator(
            color: Theme.of(context).colorScheme.onSecondary.withAlpha(50)),
      );
    }
  }
}
