import 'dart:io';

import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';

class Avatar extends StatelessWidget {
  const Avatar({Key? key, required this.userId, this.onTap}) : super(key: key);

  final String userId;
  final void Function()? onTap;

  Future<ImageProvider> _getImageProvider(String? path) async {
    if (path == null) {
      return User.getUserImageProvider(User().id);
    }

    final File file = File(path);
    try {
      await file.length();
      return FileImage(file);
    } catch (e) {
      print(e);
      return User.getUserImageProvider(User().id);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
        valueListenable: Memory().boxUser.listenable(keys: ['photoPath']),
        builder: (BuildContext context, Box box, Widget? widget) =>
            (FutureBuilder(
                future: _getImageProvider(Memory().boxUser.get('photoPath')),
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
                      ));
                })));
  }
}
