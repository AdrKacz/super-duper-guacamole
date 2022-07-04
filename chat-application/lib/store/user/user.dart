import 'package:hive/hive.dart';
import 'package:uuid/uuid.dart';

// flutter packages pub run build_runner build
part 'user.g.dart';

@HiveType(typeId: 0)
class User extends HiveObject {
  User(this.id, this.isOnline);

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

  static User me = User.loads('me', id: const Uuid().v4(), isOnline: true);

  @HiveField(0)
  String id;

  @HiveField(1)
  bool isOnline;
}
