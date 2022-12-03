import 'package:hive_flutter/hive_flutter.dart';
// ignore: depend_on_referenced_packages

class Memory {
  static const String groupUsers = 'groupUsers';
  static const String messages = 'messages';

  late final Box<String> boxUser;
  late final Box<String> boxAnswers;
  late final Box<String> boxMessages;
  late final Box<String> boxBlockedUsers;
  late final Box<Map> boxUserProfiles;
  late final Box<Map> boxGroupUsers;
  late final Box<String> rsaKeyPairBox;

  static final Memory _instance = Memory._internal();

  factory Memory() {
    return _instance;
  }

  Memory._internal();

  Future<void> init() async {
    await Hive.initFlutter();
    boxBlockedUsers = await Hive.openBox<String>('blockedUsers');
    boxUserProfiles = await Hive.openBox<Map>('userProfiles');
    boxGroupUsers = await Hive.openBox<Map>('groupUsers');
    boxMessages =
        await Hive.openBox<String>('messages', keyComparator: ((key1, key2) {
      int date1 = int.tryParse(key1) ?? 0;
      int date2 = int.tryParse(key2) ?? 0;
      return date2 - date1;
    }));
    boxUser = await Hive.openBox<String>('user');
    boxAnswers = await Hive.openBox<String>('answers');
    rsaKeyPairBox = await Hive.openBox<String>('rsaKeyPair');
  }

  Future<void> clear() async {
    await Future.wait([
      boxUser.clear(),
      boxAnswers.clear(),
      boxMessages.clear(),
      boxBlockedUsers.clear(),
      boxUserProfiles.clear(),
      boxGroupUsers.clear(),
      rsaKeyPairBox.clear(),
    ]);
  }
}
