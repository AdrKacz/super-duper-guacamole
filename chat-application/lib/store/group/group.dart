import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:hive/hive.dart';

// flutter packages pub run build_runner build
part 'group.g.dart';

@HiveType(typeId: 1)
class Group extends HiveObject {
  // ignore: not_initialized_non_nullable_instance_field
  Group(this._id);

  factory Group.loads(String key,
      {String id = '', String boxName = 'metadata'}) {
    final dynamic user = Hive.box(boxName).get(key);
    if (user is Group) {
      return user;
    } else {
      Hive.box(boxName).put(key, Group(id));
      return Hive.box(boxName).get(key);
    }
  }

  static Group main = Group.loads('main');

  @HiveField(0)
  String _id;
  String get id => _id;

  @HiveField(1)
  HiveList users;

  void change(String newId) {
    if (_id != '') {
      print('Unsubscribe from group-$id');
      FirebaseMessaging.instance.unsubscribeFromTopic('group-$id');
      users.clear();
      _id = "";
    }
    if (newId != '') {
      print('Subscribe to group-$newId');
      FirebaseMessaging.instance.subscribeToTopic('group-$newId');
      _id = newId;
    }
  }
}
