import 'package:awachat/pointycastle/helpers.dart';
import 'package:uuid/uuid.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:awachat/store/memory.dart';

import "package:pointycastle/export.dart";

class User {
  static User _instance = User._internal();

  late String id;
  late AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> pair;

  // to be moved in a Group class
  late String _groupId;
  Map<String, Map> otherGroupUsers = {};

  String get groupId => _groupId;
  set groupId(String id) {
    // reset
    if (_groupId != "") {
      print("Reset group (unsubscribe and clear messages and users)");
      FirebaseMessaging.instance
          .unsubscribeFromTopic('group-${User().groupId}');
      Memory().boxMessages.clear();
      _groupId = "";
      Memory().lazyBoxGroupUsers.clear();
      otherGroupUsers.clear();
    }

    // set
    if (id != "") {
      print('Set group (subscribe)');
      FirebaseMessaging.instance.subscribeToTopic('group-$id');
      Memory().put('user', 'groupid', id);
      _groupId = id;
    }
  }

  factory User() {
    return _instance;
  }

  User._internal();

  void clear() {
    groupId = "";
    _instance = User._internal();
  }

  Future<void> init() async {
    // user
    String? storedId = Memory().get('user', 'id');
    AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey>? storedPair =
        retreiveRSAkeyPair();

    if (storedId == null || storedPair == null) {
      // clear memory
      await Memory().clear();

      // create user
      storedId = const Uuid().v4();
      Memory().put('user', 'id', storedId);

      storedPair = generateRSAkeyPair(exampleSecureRandom());
      storeRSAkeyPair(storedPair);
    }
    id = storedId;
    pair = storedPair;

    // TODO: move to a group class
    // group
    String? memoryGroupId = Memory().get('user', 'groupid');
    if (memoryGroupId != null) {
      _groupId = memoryGroupId;

      // group users
      otherGroupUsers = await Memory().loadGroupUsers();
    } else {
      _groupId = "";
    }

    print(
        'Init user with id $id, group $_groupId, and members $otherGroupUsers');
  }

  // Group method
  void updateOtherUsers(Map<String, dynamic> otherUsers) {
    for (final Map otherUser in otherUsers.values) {
      if (otherUser['id'] != null) {
        Map groupUser = {
          'id': otherUser['id'],
          'isActive': otherUser['isActive'] ?? false,
        };
        otherGroupUsers[otherUser['id']] = groupUser;
        Memory().addGroupUser(otherUser['id'], groupUser);
      }
    }
  }

  void updateOtherUserStatus(String id, bool isActive) {
    if (!otherGroupUsers.containsKey(id)) {
      return;
    }

    Map groupUser = {'id': id, 'isActive': isActive};
    otherGroupUsers[id] = groupUser;
    Memory().addGroupUser(id, groupUser);
  }
}
