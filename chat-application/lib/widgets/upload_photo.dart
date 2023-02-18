import 'dart:io';

import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:path/path.dart' as p;

class UploadPhoto extends StatefulWidget {
  const UploadPhoto({Key? key}) : super(key: key);

  @override
  State<UploadPhoto> createState() => _UploadPhotoState();
}

class _UploadPhotoState extends State<UploadPhoto> {
  final ImagePicker _picker = ImagePicker();

  void _onPressed() {
    print('On Pressed');
  }

  void _addPhoto() async {
    XFile? image;
    try {
      // NOTE: Looks like it crashed if you don't ask for permission first
      image = await _picker.pickImage(
          source: ImageSource.camera,
          preferredCameraDevice: CameraDevice.front);
    } on PlatformException catch (e) {
      print(e);
      if (await Permission.camera.request().isPermanentlyDenied) {
        openAppSettings();
      }
    }

    if (image == null) {
      return;
    }

    print('Get Application Documents Directory');
    final String filePath = (await getApplicationDocumentsDirectory()).path;

    print('Copy Image');
    final fileName = p.basename(image.path);
    print('To $filePath/$fileName');
    final path = '$filePath/$fileName';
    await image.saveTo(path);
    Memory().boxUser.put('photoPath', path);
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
        valueListenable: Memory().boxUser.listenable(keys: ['photoPath']),
        builder: (BuildContext context, Box box, Widget? widget) {
          final String? photoPath = Memory().boxUser.get('photoPath');

          return Scaffold(
              body: SafeArea(
                  child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              AspectRatio(
                  aspectRatio: 3 / 4,
                  child: Container(
                    margin: const EdgeInsets.all(24.0),
                    decoration: BoxDecoration(
                        image: photoPath != null
                            ? DecorationImage(
                                fit: BoxFit.cover,
                                image: FileImage(File(photoPath)),
                              )
                            : null,
                        borderRadius:
                            const BorderRadius.all(Radius.circular(8.0)),
                        color: Colors.grey.shade300),
                    child: photoPath == null
                        ? IconButton(
                            onPressed: _addPhoto,
                            icon: const Icon(Icons.add_a_photo))
                        : null,
                  )),
              Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ElevatedButton(
                      style: photoPath != null
                          ? ElevatedButton.styleFrom(
                              backgroundColor:
                                  Theme.of(context).colorScheme.background,
                              foregroundColor:
                                  Theme.of(context).colorScheme.onBackground)
                          : null,
                      onPressed: _addPhoto,
                      child: photoPath == null
                          ? const Text('''Prendre une photo''')
                          : const Text('''Reprendre une photo'''))),
              ElevatedButton(
                  onPressed: photoPath == null ? null : _onPressed,
                  child: const Text('''C'est parti !'''))
            ],
          )));
        });
  }
}
