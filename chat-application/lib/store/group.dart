import 'package:hive/hive.dart';

part 'group.g.dart';

@HiveType()
class Group extends HiveObject {
  Group._internal();

  static Group main = Group._internal();

  @HiveField(0)
  String _id;
  String get id => _id
  
  @HiveField(1)
  HiveList users;

  void change(String newId) {
    if (_id != "") {
      print("Unsubscribe from group-$id");
      FirebaseMessaging.instance
          .unsubscribeFromTopic('group-$id');
      users.clear();
      _id = ""
    }
    if (newId != "") {
      print("Subscribe to group-$newId")
      FirebaseMessaging.instance.subscribeToTopic('group-$newId');
      _id = newId
    }
  }
  
}