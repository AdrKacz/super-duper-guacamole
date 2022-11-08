import 'dart:typed_data';

import 'package:awachat/network/http_connection.dart';
import 'package:awachat/pointycastle/helpers.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:image_cropper/image_cropper.dart';

import 'package:pointycastle/export.dart';
import 'package:http/http.dart' as http;

class User {
  static User _instance = User._internal();

  String? get id => Memory().boxUser.get('id');
  AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey>? get keyPair =>
      retreiveRSAkeyPair();

  // to be moved in a Group class
  late String _groupId;

  String get groupId => _groupId;
  set groupId(String id) {
    // reset
    if (_groupId != '') {
      // reset group
      // unsubscribe
      FirebaseMessaging.instance
          .unsubscribeFromTopic('group-${User().groupId}');
      // clear messages
      Memory().boxMessages.clear();
      // clear users
      Memory().boxGroupUsers.clear();
      // clear profile (keep your profile)
      Memory().boxUser.delete('hasSharedProfile');
      final Map? profile = Memory().boxUserProfiles.get(this.id);
      Memory().boxUserProfiles.clear().then((value) {
        if (profile != null) {
          Memory().boxUserProfiles.put(this.id, profile);
        }
      });
      // reset group
      _groupId = '';
    }

    // set
    if (id != '') {
      // set group (subscribe)
      FirebaseMessaging.instance.subscribeToTopic('group-$id');
      Memory().put('user', 'groupid', id);
      _groupId = id;
    }
  }

  bool get hasGroup => _groupId != '';

  factory User() {
    return _instance;
  }

  User._internal();

  void clear() {
    groupId = '';
    _instance = User._internal();
  }

  Future<void> init() async {
    // user
    if (id == null) {
      // clear memory
      await Memory().clear();

      Memory().boxUser.put('id', const Uuid().v4());
      storeRSAkeyPair(generateRSAkeyPair(exampleSecureRandom()));
    }

    if (!(await HttpConnection().signUp())) {
      print('You can\'t sign up');
    }
    await HttpConnection().signIn();

    // TODO: move to a group class
    // group
    String? memoryGroupId = Memory().get('user', 'groupid');
    if (memoryGroupId != null) {
      _groupId = memoryGroupId;
    } else {
      _groupId = '';
    }
    // user with id, _groupid and otherGroupUsers
  }

  // Group method
  void updateOtherUsers(Map<String, dynamic> otherUsers) {
    for (final Map otherUser in otherUsers.values) {
      if (otherUser['id'] != null) {
        Map groupUser = {
          'id': otherUser['id'],
          'isActive': otherUser['isActive'] ?? false,
        };
        Memory().boxGroupUsers.put(otherUser['id'], groupUser);
      }
    }
  }

  updateOtherUserArgument(String id, String key, dynamic value) {
    Map? groupUser = Memory().boxGroupUsers.get(id);
    if (groupUser == null) {
      return;
    }
    groupUser[key] = value;
    Memory().boxGroupUsers.put(id, groupUser);
  }

  void updateOtherUserStatus(String id, bool isActive) {
    updateOtherUserArgument(id, 'isActive', isActive);
  }

  void updateOtherUserProfile(String id, String profile) {
    updateOtherUserArgument(id, 'profile', profile);
  }

  void setOtherUserHasSeenProfile(String id) {
    updateOtherUserArgument(id, 'hasSeenProfile', true);
  }

  Future<XFile?> _pickImage(BuildContext context, String type) async {
    late final XFile? image;
    try {
      // TODO: allow bigger image to be sent (here it is already long and bigger image are not sent)
      final ImagePicker picker = ImagePicker();
      image = await picker.pickImage(
          source: type == 'camera' ? ImageSource.camera : ImageSource.gallery);
    } catch (error) {
      await showDialog(
          context: context,
          builder: (BuildContext context) {
            return AlertDialog(
                title: const Text('Je ne peux pas faire cette action 😔'),
                content: const Text(
                    'Ouvre les paramètres de ton téléphone et donne moi les autorisations nécessaires.'),
                actions: <Widget>[
                  TextButton(
                      child: const Text('Ouvrir les paramètres'),
                      onPressed: () async {
                        if (!await openAppSettings()) {
                          Navigator.pop(context);
                        }
                      })
                ]);
          });
      return null;
    }

    return image;
  }

  Future<CroppedFile?> _cropImage(XFile image,
      {Color? toolbarColor, Color? toolbarWidgetColor}) {
    return ImageCropper().cropImage(
        maxHeight: 128,
        maxWidth: 128,
        sourcePath: image.path,
        aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
        cropStyle: CropStyle.circle,
        uiSettings: [
          AndroidUiSettings(
              toolbarTitle: '',
              toolbarColor: toolbarColor,
              toolbarWidgetColor: toolbarWidgetColor,
              initAspectRatio: CropAspectRatioPreset.original,
              lockAspectRatio: false),
        ]);
  }

  Future<String?> _getImageType(BuildContext context,
      {required Map profile, required Color onPrimaryColor}) {
    final List<Widget> typeActions = [
      SimpleDialogOption(
        onPressed: () {
          Navigator.pop(context, 'camera');
        },
        child: const Text('Prendre une photo'),
      ),
      SimpleDialogOption(
        onPressed: () {
          Navigator.pop(context, 'gallery');
        },
        child: const Text('Choisir une photo'),
      ),
    ];

    if (profile['picture'] is Uint8List) {
      typeActions.insert(
          0,
          SimpleDialogOption(
            onPressed: () {
              Navigator.pop(context, 'memory');
            },
            child: Text('Envoyer la photo déjà enregistrée',
                style: TextStyle(color: onPrimaryColor)),
          ));
    }

    return showDialog(
        context: context,
        builder: (BuildContext context) {
          return SimpleDialog(
            children: typeActions,
          );
        });
  }

  Future<http.Response?> shareProfile(BuildContext context) async {
    final Map profile = Memory().boxUserProfiles.get(id) ?? {};

    final Color primaryColor = Theme.of(context).colorScheme.primary;
    final Color onPrimaryColor = Theme.of(context).colorScheme.onPrimary;

    final String? type = await _getImageType(context,
        profile: profile, onPrimaryColor: onPrimaryColor);

    if (type == null) {
      return null;
    }

    if (type == 'memory') {
      Memory().boxUser.put('hasSharedProfile', 'true');
      return HttpConnection().legacyPut('share-profile', {'profile': profile});
    }

    // ignore: use_build_context_synchronously
    final XFile? image = await _pickImage(context, type);

    if (image == null) {
      return null;
    }

    // crop image
    final CroppedFile? croppedFile = await _cropImage(image,
        toolbarColor: primaryColor, toolbarWidgetColor: onPrimaryColor);

    if (croppedFile == null) {
      return null;
    }

    // save image
    profile['picture'] = await croppedFile.readAsBytes();
    await Memory().boxUserProfiles.put(id, profile);

    Memory().boxUser.put('hasSharedProfile', 'true');
    return HttpConnection().legacyPut('share-profile', {'profile': profile});
  }

  static T _getUserImageOrImageProvider<T>(id,
      {required T Function(String) networkImage,
      required T Function(Uint8List) memoryImage}) {
    if (id == User().id && Memory().boxUser.get('hasSharedProfile') != 'true') {
      return networkImage('https://avatars.dicebear.com/api/bottts/$id.png');
    }

    final Map profile = Memory().boxUserProfiles.get(id) ?? {};
    if (profile['picture'] is Uint8List) {
      return memoryImage(profile['picture']);
    } else {
      return networkImage('https://avatars.dicebear.com/api/bottts/$id.png');
    }
  }

  static ImageProvider getUserImageProvider(id) {
    return _getUserImageOrImageProvider<ImageProvider>(id,
        networkImage: NetworkImage.new, memoryImage: MemoryImage.new);
  }

  static Image getUserImage(id) {
    return _getUserImageOrImageProvider<Image>(id,
        networkImage: Image.network, memoryImage: Image.memory);
  }
}
