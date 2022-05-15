import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/message.dart';

class Memory {
  late final Box<String> boxUser;
  late final LazyBox<String> lazyBoxMessages;
  late final LazyBox<Map> lazyBoxGroupUsers;

  static final Memory _instance = Memory._internal();

  factory Memory() {
    return _instance;
  }

  Memory._internal();

  Future<void> init() async {
    await Hive.initFlutter();
    lazyBoxGroupUsers = await Hive.openLazyBox<Map>('groupUsers');
    lazyBoxMessages = await Hive.openLazyBox<String>('messages');
    boxUser = await Hive.openBox<String>('user');
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
    await boxUser.clear();
    await lazyBoxMessages.clear();
    await lazyBoxGroupUsers.clear();
  }

  void addGroupUser(String id, Map user) {
    lazyBoxGroupUsers.put(id, user);
  }

  void deleteGroupUser(String id) {
    lazyBoxGroupUsers.delete(id);
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
    lazyBoxMessages.put(id, text);
  }

  void deleteMessage(String? id) {
    if (id == null) {
      return;
    }
    lazyBoxMessages.delete(id);
  }

  Future<List<types.Message>> loadMessages() async {
    List<types.Message> messages = [];

    for (final String key in lazyBoxMessages.keys) {
      types.Message? message = messageDecode(await lazyBoxMessages.get(key));
      if (message != null) {
        messages.insert(0, message);
      }
    }

    return messages;
  }
}
