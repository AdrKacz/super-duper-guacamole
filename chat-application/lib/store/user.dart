import 'dart:io';

import 'package:awachat/network/http_connection.dart';
import 'package:awachat/pointycastle/helpers.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';
import 'package:pointycastle/export.dart';
// ignore: depend_on_referenced_packages
import 'package:path/path.dart' as p;

class User {
  static final User _instance = User._internal();

  late AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> pair;

  String? get id => Memory().boxUser.get('id');

  String? get groupId => Memory().boxUser.get('groupId');

  Future<void> updateGroupId(String groupId) async {
    await resetGroup();

    Memory().boxUser.put('groupId', groupId);
  }

  factory User() {
    return _instance;
  }

  User._internal();

  Future<void> init() async {
    AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey>? storedPair =
        retreiveRSAkeyPair();

    if (!Memory().boxUser.containsKey('id') || storedPair == null) {
      // clear memory
      await Memory().clear();

      // create user
      Memory().boxUser.put('id', const Uuid().v4());

      storedPair = generateRSAkeyPair(exampleSecureRandom());
      storeRSAkeyPair(storedPair);
    }
    pair = storedPair;

    await HttpConnection().signUp();
    await HttpConnection().signIn();
  }

  Future<void> resetGroup() async {
    await Future.wait([
      Memory().boxMessages.clear(), // clear messages
      Memory().boxGroupUsers.clear(), // clear users
      Memory().boxUser.delete('groupId'),
    ]);
  }

  Future<void> updateGroupUsers(Map<String, Map> groupUsers) async {
    final Set<String> newGroupUsersKeys = groupUsers.keys.toSet();
    final Set<String> oldGroupUsersKeys =
        Memory().boxGroupUsers.keys.toSet().cast<String>();

    final Set<String> unionGroupUsersKeys =
        newGroupUsersKeys.union(oldGroupUsersKeys);

    for (final String groupUserKey in unionGroupUsersKeys) {
      if (newGroupUsersKeys.contains(groupUserKey)) {
        Map? user = Memory().boxGroupUsers.get(groupUserKey) ?? {};
        Map groupUser = groupUsers[groupUserKey]!;

        Map userData = await HttpConnection().post(
            path: 'download-user',
            body: {'id': groupUser['id'], 'lastUpdate': user['lastUpdate']});

        user.addAll(
            {'id': groupUser['id'], 'isConnected': groupUser['isConnected']});

        if (userData['data'] != null) {
          user.addAll({
            'data': userData['data'],
            'lastUpdate': userData['data']?['lastUpdate']
          });
        }

        if (userData['image'] != null) {
          final String directoryPath =
              (await getApplicationDocumentsDirectory()).path;
          final imageExtension = p.extension(userData['data']?['imagePath']);
          final String path =
              '$directoryPath/${groupUser['id']}/image$imageExtension';

          user.addAll({'imagePath': path});
        }

        print('newUser $user');

        Memory().boxGroupUsers.put(groupUser['id'], user);
      } else {
        // delete image if any
        Map? user = Memory().boxGroupUsers.get(groupUserKey);
        if (user == null) {
          continue;
        }
        if (user['imagePath'] is String) {
          await File(user['imagePath']).delete();
        }
        await Memory().boxGroupUsers.delete(groupUserKey);
      }
    }
  }

  void updateGroupUserArgument(String id, String key, dynamic value) {
    Map? groupUser = Memory().boxGroupUsers.get(id);
    if (groupUser == null) {
      return;
    }
    groupUser[key] = value;
    Memory().boxGroupUsers.put(id, groupUser);
  }

  void updateGroupUserStatus(String id, bool isConnected) {
    updateGroupUserArgument(id, 'isConnected', isConnected);
  }

  void updateGroupUserProfile(String id, String profile) {
    updateGroupUserArgument(id, 'profile', profile);
  }

  static ImageProvider getUserImageProvider(id) {
    return NetworkImage('https://avatars.dicebear.com/api/bottts/$id.png');
  }
}
