import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:awachat/memory.dart';
import 'package:uuid/uuid.dart';

class User {
  static final User _instance = User._internal();

  late types.User user;

  factory User() {
    return _instance;
  }

  Future<void> init() async {
    String? userId = Memory().get('user', 'id');
    if (userId == null) {
      user = types.User(id: const Uuid().v4());
      Memory().put('user', 'id', user.id);
    } else {
      user = types.User(id: userId);
    }
  }

  User._internal();
}
