import 'package:awachat/store/user/user.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:hive/hive.dart';

// flutter packages pub run build_runner build
part 'group.g.dart';

@HiveType(typeId: 1)
class Group extends HiveObject {
  Group(this._id, this._users);

  factory Group.loads(String key,
      {String id = '', String boxName = 'metadata'}) {
    final dynamic user = Hive.box(boxName).get(key);
    if (user is Group) {
      return user;
    } else {
      Hive.box(boxName).put(key, Group(id, HiveList(Hive.box(boxName))));
      return Hive.box(boxName).get(key);
    }
  }

  static Group get main => Group.loads('main');

  @HiveField(0)
  String _id;
  String get id => _id;

  @HiveField(1)
  HiveList _users;
  List<User> get users {
    List<User> users = [];
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
    print('ADD $addedUsers');
    print('TO $users');
    final setUsers = users.toSet();
    for (final addedUser in addedUsers) {
      if (!setUsers.contains(addedUser)) {
        _users.add(addedUser);
      }
    }
    print('RESULTS $users');
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
