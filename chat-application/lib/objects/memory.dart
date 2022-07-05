import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/message.dart';

class Memory {
  late final Box<String> boxMessages;
  late final Box<String> boxBlockedUsers;

  static final Memory _instance = Memory._internal();

  factory Memory() {
    return _instance;
  }

  Memory._internal();

  Future<void> init() async {
    boxBlockedUsers = await Hive.openBox<String>('blockedUsers');
    boxMessages = await Hive.openBox<String>('messages');
  }

  Future<void> clear() async {
    await Future.wait([
      boxMessages.clear(),
      boxBlockedUsers.clear(),
    ]);
  }

  void addBlockedUser(String id) {
    boxBlockedUsers.add(id);
  }

  List<String> getBlockedUsers() {
    print('BlockUser: ${boxBlockedUsers.values.toList()}');
    return boxBlockedUsers.values.toList();
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
