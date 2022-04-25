import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:awachat/memory.dart';
import 'package:uuid/uuid.dart';

class User {
  static final User _instance = User._internal();

  late String id;
  String _groupid = "";

  String get groupid => _groupid;
  set groupid(String id) {
    if (_groupid != "") {
      resetGroup();
    }

    if (id != "") {
      FirebaseMessaging.instance.subscribeToTopic('group-$id');
      Memory().put('user', 'groupid', id);
      _groupid = id;
    }
  }

  void resetGroup() {
    if (_groupid != "") {
      FirebaseMessaging.instance
          .unsubscribeFromTopic('group-${User().groupid}');
      Memory().lazyBoxMessages.clear();
      Memory().put('user', 'lastmessage', '0');
      _groupid = "";
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
      _groupid = memoryGroupId;
    } else {
      _groupid = "";
    }
    print('Init user with id $id');
  }
}
