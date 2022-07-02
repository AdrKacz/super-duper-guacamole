import 'package:hive/hive.dart';
import 'package:uuid/uuid.dart';

// flutter packages pub run build_runner build
part 'user.g.dart';

@HiveType(typeId: 0)
class User extends HiveObject {
  User(this.id, this.isOnline);

  static User me = User(const Uuid().v4(), true);

  @HiveField(0)
  String id;

  @HiveField(1)
  bool isOnline;
}
