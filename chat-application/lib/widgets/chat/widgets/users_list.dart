import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/typing_indicator.dart';
import 'package:flutter/material.dart';
import 'package:badges/badges.dart' as badges;
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
                            clipBehavior: Clip.none,
                            alignment: AlignmentDirectional.center,
                            children: [
                              CircleAvatar(
                                  backgroundColor: Colors.transparent,
                                  backgroundImage:
                                      User.getUserImageProvider(user['id'])),
                              badges.Badge(
                                  showBadge: user['isConnected'] ?? false,
                                  badgeStyle: badges.BadgeStyle(
                                      badgeColor: Theme.of(context)
                                          .colorScheme
                                          .tertiary),
                                  position: badges.BadgePosition.bottomEnd(),
                                  child: const SizedBox(
                                      width: kToolbarHeight * .5,
                                      height: kToolbarHeight * .5)),
                              const Positioned(
                                  top: kToolbarHeight * .5,
                                  left: kToolbarHeight * .5,
                                  child: TypingIndicator())
                            ]))
                    .toList());
          } else {
            return const SizedBox.shrink();
          }
        });
  }
}
