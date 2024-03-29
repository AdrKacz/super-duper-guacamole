import 'dart:io';

import 'package:awachat/dialogs/user.dart';
import 'package:awachat/store/group_user.dart';
import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';

class Avatar extends StatelessWidget {
  const Avatar({Key? key, required this.userId, this.radius}) : super(key: key);

  final String userId;
  final double? radius;

  Future<ImageProvider> _getImageProvider(String? relativePath) async {
    if (relativePath == null) {
      return GroupUser(userId).imageProvider;
    }

    final String directoryPath =
        (await getApplicationDocumentsDirectory()).path;

    final String path = '$directoryPath$relativePath';

    final File file = File(path);
    try {
      await file.length();
      return FileImage(file);
    } catch (e) {
      print('Error with Avatar for user $userId: $e');
      // remove user image as error occurs
      GroupUser(userId).updateArguments({
        'imageRelativePath': null,
        'lastUpdate': null,
      });
      // display placeholder
      return GroupUser(userId).imageProvider;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
        valueListenable: Memory().boxGroupUsers.listenable(keys: [userId]),
        builder: (BuildContext context, Box box, Widget? widget) =>
            (FutureBuilder(
                future: _getImageProvider(
                    GroupUser(userId).getArgument('imageRelativePath')),
                builder: (BuildContext context, AsyncSnapshot snapshot) {
                  Color? backgroundColor = Colors.transparent;
                  ImageProvider? backgroundImage;
                  if (snapshot.hasData && snapshot.data is ImageProvider) {
                    backgroundImage = snapshot.data;
                  }

                  return InkWell(
                      onTap: () => (dialogUser(context, userId)),
                      customBorder: const CircleBorder(),
                      child: CircleAvatar(
                        backgroundColor: backgroundColor,
                        backgroundImage: backgroundImage,
                        radius: radius,
                      ));
                })));
  }
}
