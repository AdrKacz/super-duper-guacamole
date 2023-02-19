import 'package:awachat/network/http_connection.dart';
import 'package:awachat/pointycastle/helpers.dart';
import 'package:uuid/uuid.dart';
import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';
import 'package:pointycastle/export.dart';

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

  Future<void> updateGroupUsers(
      Map<String, Map<dynamic, dynamic>> groupUsers) async {
    await Memory().boxGroupUsers.clear();
    await Memory().boxGroupUsers.putAll(groupUsers);
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
