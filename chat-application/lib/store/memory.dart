import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/message.dart';

class Memory {
  late final Box<String> boxUser;
  late final Box<String> boxMessages;
  late final Box<String> boxBlockedUsers;
  late final LazyBox<Map> lazyBoxGroupUsers;
  late final Box<String> rsaKeyPairBox;

  static final Memory _instance = Memory._internal();

  factory Memory() {
    return _instance;
  }

  Memory._internal();

  Future<void> init() async {
    await Hive.initFlutter();
    lazyBoxGroupUsers = await Hive.openLazyBox<Map>('groupUsers');
    boxBlockedUsers = await Hive.openBox<String>('blockedUsers');
    boxMessages = await Hive.openBox<String>('messages');
    boxUser = await Hive.openBox<String>('user');
    rsaKeyPairBox = await Hive.openBox<String>('rsaKeyPair');
  }

  String? get(String box, String field) {
    switch (box) {
      case 'user':
        return boxUser.get(field);
      default:
        return null;
    }
  }

  void put(String box, String field, String value) {
    switch (box) {
      case 'user':
        boxUser.put(field, value);
        break;
    }
  }

  Future<void> clear() async {
    await Future.wait([
      boxUser.clear(),
      boxMessages.clear(),
      boxBlockedUsers.clear(),
      lazyBoxGroupUsers.clear(),
      rsaKeyPairBox.clear(),
    ]);
  }

  void addGroupUser(String id, Map user) {
    lazyBoxGroupUsers.put(id, user);
  }

  void deleteGroupUser(String id) {
    lazyBoxGroupUsers.delete(id);
  }

  void addBlockedUser(String id) {
    boxBlockedUsers.add(id);
  }

  List<String> getBlockedUsers() {
    print('BlockUser: ${boxBlockedUsers.values.toList()}');
    return boxBlockedUsers.values.toList();
  }

  Future<Map<String, Map>> loadGroupUsers() async {
    Map<String, Map> groupUsers = {};

    for (final String key in lazyBoxGroupUsers.keys) {
      Map? groupUser = await lazyBoxGroupUsers.get(key);
      if (groupUser != null) {
        groupUsers[groupUser['id']] = groupUser;
      }
    }

    return groupUsers;
  }

  void addMessage(String? id, String? text) {
    if (id == null || text == null) {
      return;
    }
    boxMessages.put(id, text);
  }

  void deleteMessage(String? id) {
    if (id == null) {
      return;
    }
    boxMessages.delete(id);
  }

  List<types.Message> loadMessages() {
    List<types.Message> messages = [];

    for (final String key in boxMessages.keys) {
      types.Message? message = messageDecode(boxMessages.get(key));
      if (message != null) {
        messages.insert(0, message);
      }
    }

    return messages;
  }
}
