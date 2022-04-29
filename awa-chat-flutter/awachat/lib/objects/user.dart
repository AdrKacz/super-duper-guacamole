import 'package:uuid/uuid.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:awachat/objects/memory.dart';

class User {
  static final User _instance = User._internal();

  late String id;

  // to be moved in a Group class
  String _groupId = "";
  final Map<String, Map> otherGroupUsers =
      {}; // it is modified but not re-assigned

  String get groupId => _groupId;
  set groupId(String id) {
    // reset
    if (_groupId != "") {
      FirebaseMessaging.instance
          .unsubscribeFromTopic('group-${User().groupId}');
      Memory().lazyBoxMessages.clear();
      Memory().put('user', 'lastmessage', '0');
      _groupId = "";
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
    String? userId = Memory().get('user', 'id');
    if (userId == null) {
      userId = const Uuid().v4();
      Memory().put('user', 'id', userId);
    }
    id = userId;
    String? memoryGroupId = Memory().get('user', 'groupid');
    if (memoryGroupId != null) {
      _groupId = memoryGroupId;
    } else {
      _groupId = "";
    }
    print('Init user with id $id');
  }

  // Group method
  void updateOtherUsers(List<String> otherUserIds) {
    for (final String otherUserId in otherUserIds) {
      if (!otherGroupUsers.containsKey(otherUserId)) {
        otherGroupUsers[otherUserId] = {
          'id': otherUserId,
          'isActive': false,
        };
      }
    }
  }
}
