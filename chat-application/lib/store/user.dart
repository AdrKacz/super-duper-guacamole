import 'package:hive/hive.dart';

part 'user.g.dart';

@HiveType(typeId: 0)
class User extends HiveObject {
  User(this.id, this.isOnline);

  User._internal() {
    print("Create new user");
    this.id = const Uuid().v4();
    this.isOnline = true;
  }

  static User me = User._internal();

  @HiveField(0)
  String id;

  @HiveField(1)
  bool isOnline;
}