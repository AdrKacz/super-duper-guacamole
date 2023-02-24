import 'dart:io';
import 'package:awachat/store/user.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:awachat/store/memory.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
// ignore: depend_on_referenced_packages
import 'package:path/path.dart' as p;

class PhotoField extends StatefulWidget {
  const PhotoField({Key? key}) : super(key: key);

  @override
  State<PhotoField> createState() => _PhotoFieldState();
}

class _PhotoFieldState extends State<PhotoField> {
  final ImagePicker _picker = ImagePicker();

  Future<File?> _getFile(String? path) async {
    if (path == null) {
      return null;
    }

    final File file = File(path);

    try {
      await file.length();
      return file;
    } catch (e) {
      return null;
    }
  }

  Future<CroppedFile?> _cropImage(XFile image,
      {Color? toolbarColor, Color? toolbarWidgetColor}) {
    return ImageCropper().cropImage(
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

  void _addImage(Color? toolbarColor, Color? toolbarWidgetColor) async {
    XFile? image;
    try {
      // NOTE: Looks like it crashed if you don't ask for permission first
      image = await _picker.pickImage(
          source: ImageSource
              .camera, // how to handle Server Errors "Request Entity Tool Large" (enforce max size or multipart upload)
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

    final CroppedFile? croppedImage = await _cropImage(image,
        toolbarColor: toolbarColor, toolbarWidgetColor: toolbarWidgetColor);

    if (croppedImage == null) {
      return;
    }

    final File croppedImageFile = File(croppedImage.path);

    final String directoryPath =
        (await getApplicationDocumentsDirectory()).path;
    final imageExtension = p.extension(croppedImageFile.path);
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    final String path =
        '$directoryPath/users/${User().id}/images/$timestamp$imageExtension';

    await Directory(p.dirname(path)).create(recursive: true);

    print('Copy Image to $path');
    await croppedImageFile.copy(path);

    User().updateGroupUserArguments(User().id!, {
      'imagePath': path,
      'lastUpdate': DateTime.now().millisecondsSinceEpoch.toString()
    });
  }

  bool hasFile = false;
  @override
  Widget build(BuildContext context) {
    return FormField(
        validator: (dynamic value) {
          if (!hasFile) {
            return 'Tu dois prendre une photo.';
          }
        },
        builder: (FormFieldState<dynamic> state) => (ValueListenableBuilder(
            valueListenable:
                Memory().boxGroupUsers.listenable(keys: [User().id]),
            builder: (BuildContext context, Box box, Widget? widget) =>
                (FutureBuilder(
                    future: _getFile(
                        User().getGroupUserArgument(User().id!, 'imagePath')),
                    builder: (BuildContext context, AsyncSnapshot snapshot) {
                      DecorationImage? decorationImage;
                      Widget? child;
                      Text? text;
                      ButtonStyle? buttonStyle;
                      addPhotoWithTheme() {
                        _addImage(Theme.of(context).colorScheme.primary,
                            Theme.of(context).colorScheme.onPrimary);
                      }

                      hasFile = false; // reset has file on re-render
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        child =
                            const Center(child: CircularProgressIndicator());
                        text = const Text('''Prendre une photo''');
                      } else {
                        if (snapshot.hasData && snapshot.data is File) {
                          decorationImage = DecorationImage(
                            fit: BoxFit.cover,
                            image: FileImage(snapshot.data),
                          );
                          text = const Text('''Reprendre une photo''');
                          buttonStyle = ElevatedButton.styleFrom(
                              backgroundColor:
                                  Theme.of(context).colorScheme.background,
                              foregroundColor:
                                  Theme.of(context).colorScheme.onBackground);
                          hasFile = true; // a valid file is available
                        } else {
                          child = IconButton(
                              onPressed: addPhotoWithTheme,
                              icon: const Icon(Icons.add_a_photo));
                          text = const Text('''Prendre une photo''');
                        }
                      }

                      return Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: <Widget>[
                            AspectRatio(
                                aspectRatio: 3 / 4,
                                child: Container(
                                  margin: const EdgeInsets.all(24.0),
                                  decoration: BoxDecoration(
                                      image: decorationImage,
                                      borderRadius: const BorderRadius.all(
                                          Radius.circular(8.0)),
                                      color: Colors.grey.shade300),
                                  child: child,
                                )),
                            ElevatedButton(
                                style: buttonStyle,
                                onPressed: addPhotoWithTheme,
                                child: text),
                            state.hasError
                                ? Text(state.errorText!,
                                    style: const TextStyle(color: Colors.red))
                                : Container()
                          ]);
                    })))));
  }
}
