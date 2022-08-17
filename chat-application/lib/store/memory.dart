import 'package:hive_flutter/hive_flutter.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/message.dart';

class Memory {
  late final Box<String> boxUser;
  late final Box<String> boxAnswers;
  late final Box<String> boxMessages;
  late final Box<String> boxBlockedUsers;
  late final Box<String> rsaKeyPairBox;

  static final Memory _instance = Memory._internal();

  factory Memory() {
    return _instance;
  }

  Memory._internal();

  Future<void> init() async {
    await Hive.initFlutter();
    boxBlockedUsers = await Hive.openBox<String>('blockedUsers');
    boxMessages = await Hive.openBox<String>('messages');
    boxUser = await Hive.openBox<String>('user');
    boxAnswers = await Hive.openBox<String>('answers');
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
      boxAnswers.clear(),
      boxMessages.clear(),
      boxBlockedUsers.clear(),
      rsaKeyPairBox.clear(),
    ]);
  }

  void addBlockedUser(String id) {
    boxBlockedUsers.add(id);
  }

  List<String> getBlockedUsers() {
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

  // Helper for boxAnswer (marker to note if last round or note)
  bool isAnswerMarked(String answer) {
    return answer.startsWith('_');
  }

  String? getUnmarkedAnswer(String key) {
    final String? answer = boxAnswers.get(key);
    if (answer != null && isAnswerMarked(answer)) {
      return answer.substring(1);
    }
    return answer;
  }

  String markedAnswer(String answer) {
    if (isAnswerMarked(answer)) {
      return answer;
    }
    return '_$answer';
  }

  String unmarkedAnswer(String answer) {
    if (isAnswerMarked(answer)) {
      return answer.substring(1);
    }
    return answer;
  }
}
