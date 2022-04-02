import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/memory.dart';
import 'package:uuid/uuid.dart';

class User {
  static final User _instance = User._internal();

  late final types.User user;
  String _groupid = "";

  String get groupid => _groupid;
  set groupid(String id) {
    FirebaseMessaging.instance.subscribeToTopic('group-$id');
    Memory().put('user', 'groupid', id);
    _groupid = id;
  }

  factory User() {
    return _instance;
  }

  User._internal();

  Future<void> init() async {
    String? userId = Memory().get('user', 'id');
    if (userId == null) {
      user = types.User(id: const Uuid().v4());
      Memory().put('user', 'id', user.id);
    } else {
      user = types.User(id: userId);
    }
    String? memoryGroupId = Memory().get('user', 'groupid');
    if (memoryGroupId != null) {
      _groupid = memoryGroupId;
    }
  }
}
