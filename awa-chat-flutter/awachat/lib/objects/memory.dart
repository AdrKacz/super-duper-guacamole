import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/message.dart';

class Memory {
  late final Box<String> boxUser;
  late final LazyBox<String> lazyBoxMessages;

  static final Memory _instance = Memory._internal();

  factory Memory() {
    return _instance;
  }

  Memory._internal();

  Future<void> init() async {
    await Hive.initFlutter();
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
  }

  void addMessage(String? id, String? text) async {
    if (text == null) {
      return;
    }

    lazyBoxMessages.put(id, text);
    // verify if message already exist (to no add to lasstmessage badly)
    String? data = await lazyBoxMessages.get(id);
    if (data == null) {
      final int lastmessage = int.parse(boxUser.get("lastmessage") ?? "0");
      boxUser.put("lastmessage", (lastmessage + 1).toString());
    }
  }

  void deleteMessage(String? id) async {
    if (id == null) {
      return;
    }
    // verify message exist (to no reduce lastmessage badly)
    String? data = await lazyBoxMessages.get(id);
    if (data != null) {
      lazyBoxMessages.delete(id);
      final int lastmessage = int.parse(boxUser.get("lastmessage") ?? "0");
      boxUser.put("lastmessage", (lastmessage - 1).toString());
    }
  }

  Future<List<types.Message>> loadMessages() async {
    List<types.Message> messages = [];

    for (int i = 0; i < int.parse(boxUser.get('lastmessage') ?? '0'); i++) {
      types.Message? message = messageDecode(await lazyBoxMessages.getAt(i));
      if (message != null) {
        messages.insert(0, message);
      }
    }
    return messages;
  }
}
