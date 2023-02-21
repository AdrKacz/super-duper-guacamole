import 'dart:convert';
import 'dart:io';
import 'package:awachat/network/http_connection.dart';
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
import 'package:go_router/go_router.dart';

class UploadPhoto extends StatefulWidget {
  const UploadPhoto({Key? key}) : super(key: key);

  @override
  State<UploadPhoto> createState() => _UploadPhotoState();
}

class _UploadPhotoState extends State<UploadPhoto> {
  final ImagePicker _picker = ImagePicker();

  void _onPressed() {
    String? imageExtension;
    _getFile(Memory().boxUser.get('imagePath'))
        .then((File? imageFile) {
          if (imageFile == null) {
            throw Exception('Image file is not defined');
          }
          imageExtension = p.extension(imageFile.path);
          return imageFile.readAsBytes();
        })
        .then((Uint8List imageBytes) => (base64Encode(imageBytes)))
        .then((String base64Image) => (HttpConnection().post(
            path: 'upload-user',
            body: {'image': base64Image, 'imageExtension': imageExtension})))
        .catchError((error) => (print('Error while uploading image: $error')));

    context.go('/chat');
    /*
      image length is approx 2 MB, Amazon recommends to use Multipart Form when
      data becomes larger than 100 MB - print(await croppedImageFile.length())
      Resources:
      https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html
      https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings-configure-with-console.html
      https://stackoverflow.com/questions/41756190/api-gateway-post-multipart-form-data
      https://pub.dev/documentation/http/latest/http/MultipartRequest-class.html
      Multipart Upload Sample:
        final http.MultipartRequest request =
            http.MultipartRequest('POST', Uri.parse('$_httpEndpoint/$path'));
        request.fields['hello'] = 'world';
        request.files
            .add(await http.MultipartFile.fromPath('image', filePath));

        request.headers.addAll({
          HttpHeaders.contentTypeHeader: 'multipart/form-data',
          HttpHeaders.authorizationHeader:
              'Bearer ${Memory().boxUser.get('jwt')}'
        });

        final http.StreamedResponse response = await request.send();
        print(
            'MULTIPART POST statusCode (${response.statusCode}) - reasonPhrase (${response.reasonPhrase})');
        return response;
    */
  }

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

    final CroppedFile? croppedImage = await _cropImage(image,
        toolbarColor: toolbarColor, toolbarWidgetColor: toolbarWidgetColor);

    if (croppedImage == null) {
      return;
    }

    final File croppedImageFile = File(croppedImage.path);

    final String directoryPath =
        (await getApplicationDocumentsDirectory()).path;
    final imageExtension = p.extension(croppedImageFile.path);
    final String path = '$directoryPath/${User().id}/image$imageExtension';

    await Directory(p.dirname(path)).create(recursive: true);

    print('Copy Image to $path');
    await croppedImageFile.copy(path);

    Memory().boxUser.put('imagePath', path);

    Memory()
        .boxUser
        .put('lastUpdate', DateTime.now().millisecondsSinceEpoch.toString());
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
        valueListenable: Memory().boxUser.listenable(keys: ['imagePath']),
        builder: (BuildContext context, Box box, Widget? widget) =>
            (FutureBuilder(
                future: _getFile(Memory().boxUser.get('imagePath')),
                builder: (BuildContext context, AsyncSnapshot snapshot) {
                  DecorationImage? decorationImage;
                  Widget? child;
                  Text? text;
                  ButtonStyle? buttonStyle;
                  void Function()? function;
                  addPhotoWithTheme() {
                    _addImage(Theme.of(context).colorScheme.primary,
                        Theme.of(context).colorScheme.onPrimary);
                  }

                  if (snapshot.connectionState == ConnectionState.waiting) {
                    child = const Center(child: CircularProgressIndicator());
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
                      function = _onPressed;
                    } else {
                      child = IconButton(
                          onPressed: addPhotoWithTheme,
                          icon: const Icon(Icons.add_a_photo));
                      text = const Text('''Prendre une photo''');
                    }
                  }

                  print('$snapshot, ${snapshot.hasData}, ${snapshot.hasError}');

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
                                  image: decorationImage,
                                  borderRadius: const BorderRadius.all(
                                      Radius.circular(8.0)),
                                  color: Colors.grey.shade300),
                              child: child,
                            )),
                        Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: ElevatedButton(
                                style: buttonStyle,
                                onPressed: addPhotoWithTheme,
                                child: text)),
                        ElevatedButton(
                            onPressed: function,
                            child: const Text('''C'est parti !'''))
                      ])));
                })));
  }
}
