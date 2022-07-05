import 'package:awachat/store/user/user.dart';
import 'package:flutter/material.dart';
import 'package:badges/badges.dart';

class UsersList extends StatelessWidget {
  const UsersList({Key? key, required this.users}) : super(key: key);

  final List<User> users;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: users
          .map((User user) => Stack(
                alignment: AlignmentDirectional.center,
                children: [
                  CircleAvatar(
                    backgroundColor: Colors.transparent,
                    backgroundImage: NetworkImage(
                        'https://avatars.dicebear.com/api/bottts/${user.id}.png'),
                  ),
                  Badge(
                      showBadge: user.isOnline,
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
  }
}
