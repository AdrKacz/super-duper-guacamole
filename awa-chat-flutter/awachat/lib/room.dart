import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:flutter_chat_types/flutter_chat_types.dart' as types;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import 'package:awachat/memory.dart';
import 'package:awachat/user.dart';

class Room {
  static const String _matchmakerEndpoint = "http://13.37.214.198:8080/room/";

  int? id;
  String? ipAddress;
  int? port;
  WebSocketChannel? channel;
  bool isConnected = false;

  static final Room _instance = Room._internal();

  factory Room() {
    return _instance;
  }

  Room._internal();

  Future<Room> update(Map<String, dynamic> json) async {
    print("[Room] Update with ${json.toString()}");

    if (channel != null) {
      await unsubscribeTopic();
      channel!.sink.close();
      await Future.delayed(const Duration(seconds: 1), () {});
      channel = null;
    }

    id = json["room_id"];
    ipAddress = json["room_address"];
    port = json["room_port"];
    print("UPDATE 1 seconds");
    channel = WebSocketChannel.connect(Uri.parse("ws://$ipAddress:$port"));
    print("UPDATE create connection");
    await subscribeTopic();
    save();

    Memory().lazyBoxMessages.clear();
    Memory().put('room', 'end', '0');

    return _instance;
  }

  Future<void> subscribeTopic() async {
    await FirebaseMessaging.instance.subscribeToTopic('room-$id');
    print('[Room] Subscribed to Firebase topic <room-$id>');
  }

  Future<void> unsubscribeTopic() async {
    await FirebaseMessaging.instance.unsubscribeFromTopic('room-$id');
    print('[Room] Unsubscribed from Firebase topic <room-$id>');
  }

  void sendMessage(types.PartialText message) {
    print("[Room] Send message to $ipAddress:$port");
    channel!.sink.add("${User().user.id}::${message.text}");
  }

  void save() {
    Memory().put('room', 'id', id.toString());
    Memory().put('room', 'ipAddress', ipAddress.toString());
    Memory().put('room', 'port', port.toString());
  }

  Future<Room> fetch() async {
    print(
        "[Room] Fetch room to ${Uri.parse(_matchmakerEndpoint + User().user.id)}");

    final response =
        await http.get(Uri.parse(_matchmakerEndpoint + User().user.id));
    print("[Room]\tReceive : ${response.statusCode}");
    print("[Room]\tReceive body : ${response.statusCode}");

    if (response.statusCode != 200) {
      return Future.error("[fetch] Internal Server Error");
    }
    final body = jsonDecode(response.body);
    //TODO: use statusCode instead of error (200 vs 204)
    if (body["error"] == null) {
      return await update(body);
    } else {
      return Future.error("[fetch] Body is not defined");
    }
  }

  Future<Room> load() async {
    String? loadedId = Memory().get('room', 'id');
    String? loadedIpAddress = Memory().get('room', 'ipAddress');
    String? loadedPort = Memory().get('room', 'port');

    if (loadedId != null && loadedIpAddress != null && loadedPort != null) {
      return await update({
        "room_id": int.parse(loadedId),
        "room_address": loadedIpAddress,
        "room_port": int.parse(loadedPort)
      });
    } else {
      return Future.error("Cannot load room from disk");
    }
  }

  // TODO: Override ondelete > disconnect
}
