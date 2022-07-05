import 'package:awachat/store/user/user.dart';
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
  HiveList _users;
  List<User> get users {
    const List<User> users = [];
    for (final user in _users) {
      if (user is User) {
        users.add(user);
      }
    }
    return users;
  }

  void change(String newId) {
    if (_id != '') {
      print('Unsubscribe from group-$id');
      FirebaseMessaging.instance.unsubscribeFromTopic('group-$id');
      deleteAllUsers();
      _id = '';
    }
    if (newId != '') {
      print('Subscribe to group-$newId');
      FirebaseMessaging.instance.subscribeToTopic('group-$newId');
      _id = newId;
    }
    save();
  }

  void addAllUsers(Iterable<User> addedUsers) {
    _users.addAll(addedUsers);
    save();
  }

  void deleteAllUsers() {
    final List<HiveObjectMixin> deletedUsers = _users.toList();
    for (final deletedUser in deletedUsers) {
      deletedUser.delete();
    }
  }

  void reset() {
    change('');
  }
}
