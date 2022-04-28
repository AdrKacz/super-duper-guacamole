import 'package:flutter/material.dart';
import 'package:badges/badges.dart';

class UsersList extends StatelessWidget {
  const UsersList({Key? key, required this.users}) : super(key: key);

  final List<Map> users;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: users
          .map((user) => Stack(
                alignment: AlignmentDirectional.center,
                children: [
                  CircleAvatar(
                    backgroundColor: Colors.transparent,
                    backgroundImage: NetworkImage(
                        "https://avatars.dicebear.com/api/croodles-neutral/${user['id']}.png"),
                  ),
                  Badge(
                      showBadge: user['isActive'],
                      badgeColor: Colors.green,
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
