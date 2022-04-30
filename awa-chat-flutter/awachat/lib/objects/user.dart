import 'dart:convert';

import 'package:uuid/uuid.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:awachat/objects/memory.dart';

class User {
  static final User _instance = User._internal();

  late String id;

  // to be moved in a Group class
  late String _groupId;
  late Map<String, Map> otherGroupUsers;

  String get groupId => _groupId;
  set groupId(String id) {
    // reset
    if (_groupId != "") {
      FirebaseMessaging.instance
          .unsubscribeFromTopic('group-${User().groupId}');
      Memory().lazyBoxMessages.clear();
      _groupId = "";
      Memory().lazyBoxGroupUsers.clear();
      otherGroupUsers.clear();
    }

    // set
    if (id != "") {
      FirebaseMessaging.instance.subscribeToTopic('group-$id');
      Memory().put('user', 'groupid', id);
      _groupId = id;
    }
  }

  factory User() {
    return _instance;
  }

  User._internal();

  Future<void> init() async {
    // get id
    String? userId = Memory().get('user', 'id');
    if (userId == null) {
      userId = const Uuid().v4();
      Memory().put('user', 'id', userId);
    }
    id = userId;
    // get group
    String? memoryGroupId = Memory().get('user', 'groupid');
    if (memoryGroupId != null) {
      _groupId = memoryGroupId;
    } else {
      _groupId = "";
    }
    // get group users
    otherGroupUsers = await Memory().loadGroupUsers();

    print(
        'Init user with id $id, group $_groupId, and members $otherGroupUsers');
  }

  // Group method
  void updateOtherUsers(List<String> otherUserIds) {
    for (final String otherUserId in otherUserIds) {
      if (!otherGroupUsers.containsKey(otherUserId)) {
        Map groupUser = {
          'id': otherUserId,
          'isActive': false,
        };
        otherGroupUsers[otherUserId] = groupUser;
        Memory().addGroupUser(otherUserId, groupUser);
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
