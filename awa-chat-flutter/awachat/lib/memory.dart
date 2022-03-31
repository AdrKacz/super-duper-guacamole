import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/message.dart';

class Memory {
  late final Box<String> boxUser;
  late final Box<String> boxRoom;
  late final LazyBox<String> lazyBoxMessages;

  static final Memory _instance = Memory._internal();

  factory Memory() {
    return _instance;
  }

  Memory._internal();

  Future<void> init() async {
    await Hive.initFlutter();
    boxRoom = await Hive.openBox<String>('room');
    lazyBoxMessages = await Hive.openLazyBox<String>('messages');
    boxUser = await Hive.openBox<String>('user');
  }

  String? get(String box, String field) {
    switch (box) {
      case 'user':
        return boxUser.get(field);
      case 'room':
        return boxRoom.get(field);
      default:
        return null;
    }
  }

  void put(String box, String field, String value) {
    switch (box) {
      case 'user':
        boxUser.put(field, value);
        break;
      case 'room':
        boxRoom.put(field, value);
        break;
    }
  }

  void addMessage(String? text) {
    if (text == null) {
      return;
    }

    lazyBoxMessages.add(text);
    int end = int.parse(boxRoom.get("end") ?? "0");
    boxRoom.put("end", (end + 1).toString());
  }

  Future<List<types.Message>> loadMessages() async {
    List<types.Message> messages = [];

    for (int i = 0; i < int.parse(boxRoom.get('end') ?? '0'); i++) {
      types.Message? message = messageFrom(await lazyBoxMessages.getAt(i));
      if (message != null) {
        messages.insert(0, message);
      }
    }
    return messages;
  }
}
