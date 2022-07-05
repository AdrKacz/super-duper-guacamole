import 'package:hive/hive.dart';
import 'package:uuid/uuid.dart';

// flutter packages pub run build_runner build
part 'user.g.dart';

@HiveType(typeId: 0)
class User extends HiveObject {
  User(this._id, this._isOnline);

  factory User.loads(String key,
      {String? id, bool isOnline = true, String boxName = 'metadata'}) {
    final dynamic user = Hive.box(boxName).get(key);
    if (user is User) {
      return user;
    } else {
      Hive.box(boxName).put(key, User(id ?? const Uuid().v4(), isOnline));
      return Hive.box(boxName).get(key);
    }
  }

  static User get me => User.loads('me', id: const Uuid().v4(), isOnline: true);

  @HiveField(0)
  String _id;
  String get id => _id;

  @HiveField(1)
  bool _isOnline;
  bool get isOnline => _isOnline;
  set isOnline(bool newIsOnline) {
    _isOnline = newIsOnline;
    save();
  }

  void reset() {
    _id = const Uuid().v4();
    _isOnline = true;
    save();
  }

  @override
  bool operator ==(other) {
    print('COMPARE $id to $other: ${other is User && id == other.id}');
    return other is User && id == other.id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'User(id: $id, isOnline: $isOnline)';
  }
}
