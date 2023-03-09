import 'dart:convert';

import 'package:awachat/dialogs/acknowledge_ban.dart';
import 'package:awachat/dialogs/user_actions.dart';
import 'package:awachat/message.dart';
import 'package:awachat/network/http_connection.dart';
import 'package:awachat/store/group_user.dart';
import 'package:awachat/store/memory.dart';
import 'package:awachat/store/user.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;

Future<void> processEvent(message, {required bool isUnreadData}) async {
  print('process message (unread data $isUnreadData) $message');
  // process message
  final data = jsonDecode(message);

  switch (data['action']) {
    case 'update-status':
      await updateStatus();
      break;
    case 'text-message':
      _messageTextMessage(data, isUnreadData: isUnreadData);
      break;
    case 'ban-request':
      banRequest(context, data['id']);
      break;
    case 'ban-reply':
      await dialogAcknowledgeBan(context, data['status'], data['bannedid']);
      break;
    case 'connect':
      GroupUser(data['id']).updateStatus(true);
      break;
    case 'disconnect':
      GroupUser(data['id']).updateStatus(false);
      break;
    default:
      print('received unknown action $data');
    // NOTE: do you want to add error on screen here?
    // NOTE: it could be a 'Internal server error' or other
  }
}

Future<void> updateStatus() async {
  Map userStatus = await HttpConnection().get(path: 'status');

  if (userStatus.isEmpty || userStatus['id'] != User().id) {
    setState(() {
      status = Status.error;
    });
    return;
  }

  if (userStatus['group'] == null) {
    // you don't have a group and didn't ask for
    changeGroup();
    return;
  }

  if (userStatus['group']['isPublic'] == false) {
    // you ask for a group but it has not opened yet
    await User().resetGroup();
    setState(() {
      status = Status.switchSent;
    });
    return;
  }
  // you have a group and can start chatting

  // update group if necessary
  if (userStatus['group']['id'] != User().groupId) {
    // doesn't have the correct group
    await User().updateGroupId(userStatus['group']['id']);
  }

  final Map<String, Map> groupUsers = {};
  for (final groupUser in userStatus['users']) {
    groupUsers[groupUser['id']] = {
      'id': groupUser['id'],
      'isConnected': groupUser['isConnected']
    };
  }
  User().updateGroupUsers(groupUsers);

  setState(() {
    // update status
    status = Status.chatting;
    connectionStatus = ConnectionStatus.connected;
  });
}

Future<void> processUnreadData() async {
  Map data = await HttpConnection().get(path: 'unread-data');

  for (final data in data['unreadData'] ?? []) {
    // TODO: make sure you don't refresh screen thousand times here
    await processEvent(jsonEncode(data), isUnreadData: true);
  }

  await HttpConnection().delete(path: 'unread-data', body: {});
}

void _messageTextMessage(data, {required bool isUnreadData}) {
  try {
    final types.TextMessage message = decodeMessage(data['message']);
    final String encodedMessage = encodeMessage(
        text: message.text,
        status: types.Status.delivered,
        author: message.author.id,
        createdAt: message.createdAt,
        id: message.id);
    Memory().boxMessages.put(message.createdAt.toString(), encodedMessage);

    if (!isUnreadData) {
      HapticFeedback.lightImpact();
    }
  } catch (e) {
    print('message text message error: $e');
  }
}

void banRequest(BuildContext context, String userId) async {
  // verify user is in group
  if (!Memory().boxGroupUsers.containsKey(userId)) {
    print('user $userId is not in your group');
    return;
  }

  HapticFeedback.mediumImpact();
  dialogBanUserActions(context, userId);
}
