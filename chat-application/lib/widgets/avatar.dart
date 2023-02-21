import 'dart:io';

import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';

class Avatar extends StatelessWidget {
  const Avatar({Key? key, required this.userId, this.onTap, this.radius})
      : super(key: key);

  final String userId;
  final double? radius;
  final void Function()? onTap;

  Future<ImageProvider> _getImageProvider(String? path) async {
    if (path == null) {
      // remove user image as error occurs
      User().updateGroupUserArguments(userId, {
        'imagePath': null,
        'lastUpdate': null,
      });
      return User.getUserImageProvider(userId);
    }

    final File file = File(path);
    try {
      await file.length();
      return FileImage(file);
    } catch (e) {
      print('Error with Avatar for user $userId: $e');
      // remove user image as error occurs
      User().updateGroupUserArguments(userId, {
        'imagePath': null,
        'lastUpdate': null,
      });
      // display placeholder
      return User.getUserImageProvider(userId);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
        valueListenable: Memory().boxGroupUsers.listenable(keys: [userId]),
        builder: (BuildContext context, Box box, Widget? widget) =>
            (FutureBuilder(
                future: _getImageProvider(
                    User().getGroupUserArgument(userId, 'imagePath')),
                builder: (BuildContext context, AsyncSnapshot snapshot) {
                  Color? backgroundColor = Colors.transparent;
                  ImageProvider? backgroundImage;
                  if (snapshot.hasData && snapshot.data is ImageProvider) {
                    backgroundImage = snapshot.data;
                  }

                  return InkWell(
                      onTap: onTap,
                      customBorder: const CircleBorder(),
                      child: CircleAvatar(
                        backgroundColor: backgroundColor,
                        backgroundImage: backgroundImage,
                        radius: radius,
                      ));
                })));
  }
}
