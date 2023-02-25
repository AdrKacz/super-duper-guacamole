import 'dart:io';

import 'package:awachat/store/group_user.dart';
import 'package:flutter/material.dart';

Future<File?> _getFile(String? path) async {
  if (path == null) {
    return null;
  }

  final File file = File(path);

  try {
    await file.length();
    return file;
  } catch (e) {
    return null;
  }
}

Future<Map> _getUserData(String userId) async {
  Map initialValues = {};
  final GroupUser groupUser = GroupUser(userId);

  // get photo
  initialValues['photo'] = await _getFile(groupUser.getArgument('imagePath'));

  // get name
  initialValues['name'] = groupUser.getArgument('name');

  return initialValues;
}

void dialogUser(BuildContext context, String userId) => (showDialog(
    context: context,
    builder: (BuildContext context) => (FutureBuilder(
        future: _getUserData(userId),
        builder: (BuildContext context, AsyncSnapshot snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return SimpleDialog(children: <Widget>[
              Center(
                  child: CircularProgressIndicator(
                      color: Theme.of(context).colorScheme.onPrimary))
            ]);
          }
          List<Widget> children = [];
          if (snapshot.hasData && snapshot.data['photo'] is File) {
            File file = snapshot.data['photo'];
            children.add(AspectRatio(
                aspectRatio: 3 / 4,
                child: Container(
                    margin: const EdgeInsets.all(24.0),
                    decoration: BoxDecoration(
                        image: DecorationImage(
                          fit: BoxFit.cover,
                          image: FileImage(file),
                        ),
                        borderRadius:
                            const BorderRadius.all(Radius.circular(8.0)),
                        color: Colors.grey.shade300))));
          }

          if (snapshot.hasData && snapshot.data['name'] is String) {
            String name = snapshot.data['name'];
            children.add(Text(name,
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onPrimary,
                    fontWeight: FontWeight.w500,
                    fontSize: 18.0)));
          }

          Widget? title;
          if (children.isEmpty) {
            title = const Text(
                'Impossible de récupérer les informations de cet utilisateur.');
          }

          return SimpleDialog(title: title, children: children);
        }))));
