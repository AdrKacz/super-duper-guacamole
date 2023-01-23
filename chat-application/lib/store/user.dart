import 'dart:typed_data';

import 'package:awachat/network/http_connection.dart';
import 'package:awachat/pointycastle/helpers.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';
import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:image_cropper/image_cropper.dart';

import 'package:pointycastle/export.dart';

class User {
  static final User _instance = User._internal();

  late AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey> pair;

  String? get id => Memory().boxUser.get('id');

  String? get groupId => Memory().boxUser.get('groupId');
  bool get hasGroup => Memory().boxUser.containsKey('groupId');

  void updateGroupId(String groupId) async {
    await resetGroup();

    Memory().boxUser.put('groupId', groupId);
  }

  factory User() {
    return _instance;
  }

  User._internal();

  Future<void> resetUser() async {
    await Memory().boxUser.delete('id');
    await init();
  }

  Future<void> init() async {
    AsymmetricKeyPair<RSAPublicKey, RSAPrivateKey>? storedPair =
        retreiveRSAkeyPair();

    if (!Memory().boxUser.containsKey('id') || storedPair == null) {
      // clear memory
      await Memory().clear();

      // create user
      Memory().boxUser.put('id', const Uuid().v4());

      storedPair = generateRSAkeyPair(exampleSecureRandom());
      storeRSAkeyPair(storedPair);
    }
    pair = storedPair;

    await HttpConnection().signUp();
    await HttpConnection().signIn();
  }

  Future<void> resetGroup() async {
    // clear messages
    Memory().boxMessages.clear();
    // clear users
    Memory().boxGroupUsers.clear();
    // clear profile (keep your profile)
    Memory().boxUser.delete('hasSharedProfile');
    final Map? profile = Memory().boxUserProfiles.get(id);

    await Memory()
        .boxUserProfiles
        .clear(); // need to await to not be sure you repopulate on something new

    if (profile != null) {
      Memory().boxUserProfiles.put(id, profile);
    }

    await Memory().boxUser.delete('groupId');
  }

  Future<void> updateGroupUsers(
      Map<String, Map<dynamic, dynamic>> groupUsers) async {
    await Memory().boxGroupUsers.clear();
    await Memory().boxGroupUsers.putAll(groupUsers);
  }

  void updateGroupUserArgument(String id, String key, dynamic value) {
    Map? groupUser = Memory().boxGroupUsers.get(id);
    if (groupUser == null) {
      return;
    }
    groupUser[key] = value;
    Memory().boxGroupUsers.put(id, groupUser);
  }

  void updateGroupUserStatus(String id, bool isConnected) {
    updateGroupUserArgument(id, 'isConnected', isConnected);
  }

  void updateGroupUserProfile(String id, String profile) {
    updateGroupUserArgument(id, 'profile', profile);
  }

  void setGroupUserHasSeenProfile(String id) {
    updateGroupUserArgument(id, 'hasSeenProfile', true);
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

  Future<void> shareProfile(BuildContext context) async {
    final Map profile = Memory().boxUserProfiles.get(id) ?? {};

    final Color primaryColor = Theme.of(context).colorScheme.primary;
    final Color onPrimaryColor = Theme.of(context).colorScheme.onPrimary;

    final String? type = await _getImageType(context,
        profile: profile, onPrimaryColor: onPrimaryColor);

    if (type == null) {
      return;
    }

    if (type == 'memory') {
      Memory().boxUser.put('hasSharedProfile', 'true');
      await HttpConnection()
          .put(path: 'share-profile', body: {'profile': profile});
    }

    // ignore: use_build_context_synchronously
    final XFile? image = await _pickImage(context, type);

    if (image == null) {
      return;
    }

    // crop image
    final CroppedFile? croppedFile = await _cropImage(image,
        toolbarColor: primaryColor, toolbarWidgetColor: onPrimaryColor);

    if (croppedFile == null) {
      return;
    }

    // save image
    profile['picture'] = await croppedFile.readAsBytes();
    await Memory().boxUserProfiles.put(id, profile);

    Memory().boxUser.put('hasSharedProfile', 'true');
    await HttpConnection()
        .put(path: 'share-profile', body: {'profile': profile});
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
