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
  bool get hasGroup => Memory().boxUser.containsKey('groupId');

  void updateGroupId(String groupId) async {
    await resetGroup();

    Memory().boxUser.put('groupId', groupId);
  }

  factory User() {
    return _instance;
  }

  User._internal();

  Future<void> resetUser() async {
    await Memory().boxUser.delete('id');
    await init();
  }

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
    // clear messages
    Memory().boxMessages.clear();
    // clear users
    Memory().boxGroupUsers.clear();
    // clear profile (keep your profile)
    Memory().boxUser.delete('hasSharedProfile');
    final Map? profile = Memory().boxUserProfiles.get(id);

    await Memory()
        .boxUserProfiles
        .clear(); // need to await to not be sure you repopulate on something new

    if (profile != null) {
      Memory().boxUserProfiles.put(id, profile);
    }

    await Memory().boxUser.delete('groupId');
  }

  Future<void> updateGroupUsers(
      Map<String, Map<dynamic, dynamic>> groupUsers) async {
    await Memory().boxGroupUsers.clear();
    Memory().boxGroupUsers.putAll(groupUsers);
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

  static T _getUserImageOrImageProvider<T>(id,
      {required T Function(String) networkImage}) {
    return networkImage('https://avatars.dicebear.com/api/bottts/$id.png');
  }

  static ImageProvider getUserImageProvider(id) {
    return _getUserImageOrImageProvider<ImageProvider>(id,
        networkImage: NetworkImage.new);
  }

  static Image getUserImage(id) {
    return _getUserImageOrImageProvider<Image>(id, networkImage: Image.network);
  }
}
