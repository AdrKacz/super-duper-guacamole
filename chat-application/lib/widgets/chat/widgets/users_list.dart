import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';
import 'package:badges/badges.dart';
import 'package:hive_flutter/hive_flutter.dart';

class UsersList extends StatelessWidget {
  const UsersList({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
        valueListenable: Hive.box<Map>(Memory.groupUsers).listenable(),
        builder: (BuildContext context, Box box, widget) {
          final Map users = box.toMap();
          users.remove(User().id);
          if (users.isNotEmpty) {
            return Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: users.values
                  .map((user) => Stack(
                        alignment: AlignmentDirectional.center,
                        children: [
                          CircleAvatar(
                            backgroundColor: Colors.transparent,
                            backgroundImage:
                                User.getUserImageProvider(user['id']),
                          ),
                          Badge(
                              showBadge: user['isConnected'] ?? false,
                              badgeColor:
                                  Theme.of(context).colorScheme.tertiary,
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
            return const SizedBox.shrink();
          }
        });
  }
}
