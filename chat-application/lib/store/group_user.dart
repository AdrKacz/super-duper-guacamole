import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;

class GroupUser {
  final String id;

  GroupUser(this.id);

  types.User get flyerUser =>
      (types.User(id: id, firstName: getArgument('name')));

  ImageProvider get imageProvider =>
      (NetworkImage('https://api.dicebear.com/5.x/fun-emoji/png?seed=$id'));

  void updateArgument(String key, dynamic value) {
    Map? groupUser = Memory().boxGroupUsers.get(id);
    if (groupUser == null) {
      return;
    }
    groupUser[key] = value;
    Memory().boxGroupUsers.put(id, groupUser);
  }

  void updateArguments(Map values) {
    Map? groupUser = Memory().boxGroupUsers.get(id);
    if (groupUser == null) {
      return;
    }
    groupUser.addAll(values);
    Memory().boxGroupUsers.put(id, groupUser);
  }

  void updateStatus(bool isConnected) {
    updateArgument('isConnected', isConnected);
  }

  void forceUpdateArguments(Map values) {
    Map groupUser = Memory().boxGroupUsers.get(id) ?? {'id': id};

    groupUser.addAll(values);
    Memory().boxGroupUsers.put(id, groupUser);
  }

  dynamic getArgument(String key) {
    Map? groupUser = Memory().boxGroupUsers.get(id);
    if (groupUser == null) {
      return;
    }

    return groupUser[key];
  }
}
