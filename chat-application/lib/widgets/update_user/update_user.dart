import 'dart:convert';
import 'package:awachat/network/http_connection.dart';
import 'package:awachat/store/group_user.dart';
import 'package:awachat/widgets/update_user/name_field.dart';
import 'package:awachat/widgets/update_user/photo_field.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'dart:io';
import 'package:awachat/store/user.dart';
import 'package:flutter/services.dart';
// ignore: depend_on_referenced_packages
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

class UpdateUser extends StatefulWidget {
  const UpdateUser({Key? key}) : super(key: key);

  @override
  State<UpdateUser> createState() => _UpdateUserState();
}

class _UpdateUserState extends State<UpdateUser> {
  final GroupUser groupUser = GroupUser(User().id!);

  Future<Map> _getInitialValues() async {
    Map initialValues = {};

    initialValues['_directoryPath'] =
        (await getApplicationDocumentsDirectory()).path;

    // get photo
    initialValues['photo'] =
        await _getFile(groupUser.getArgument('imageRelativePath'));

    // get name
    initialValues['name'] = groupUser.getArgument('name');

    return initialValues;
  }

  Future<File?> _getFile(String? relativePath) async {
    if (relativePath == null) {
      return null;
    }

    final String directoryPath =
        (await getApplicationDocumentsDirectory()).path;

    final String path = '$directoryPath$relativePath';

    final File file = File(path);

    try {
      await file.length();
      return file;
    } catch (e) {
      return null;
    }
  }

  void _uploadUserData() async {
    // get name
    String? name = groupUser.getArgument('name');

    if (name is! String) {
      throw Exception('Name is not defined');
    }

    // get image
    File? imageFile =
        await _getFile(groupUser.getArgument('imageRelativePath'));
    if (imageFile is! File) {
      throw Exception('Image file is not defined');
    }
    String imageExtension = p.extension(imageFile.path);

    Uint8List imageBytes = await imageFile.readAsBytes();
    String base64Image = base64Encode(imageBytes);

    // upload data
    await HttpConnection().post(path: 'upload-user', body: {
      'name': name,
      'image': base64Image,
      'imageExtension': imageExtension
    }).catchError((error) => (print('Error while uploading image: $error')));

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

  final _formKey = GlobalKey<FormState>();
  @override
  Widget build(BuildContext context) => (Scaffold(
      appBar: AppBar(title: const Text('Mon Profil')),
      body: SafeArea(
          child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Center(
                  child: SingleChildScrollView(
                      child: FutureBuilder(
                          future: _getInitialValues(),
                          builder:
                              (BuildContext context, AsyncSnapshot snapshot) {
                            if (snapshot.connectionState ==
                                ConnectionState.waiting) {
                              return CircularProgressIndicator(
                                  color:
                                      Theme.of(context).colorScheme.onPrimary);
                            }
                            return Form(
                                key: _formKey,
                                child: Column(children: [
                                  PhotoField(
                                      directoryPath:
                                          snapshot.data['_directoryPath'],
                                      initialValue: snapshot.data['photo']),
                                  NameField(
                                      initialValue: snapshot.data['name']),
                                  Container(
                                      margin: const EdgeInsets.only(top: 12),
                                      child: ElevatedButton(
                                          onPressed: () {
                                            if (_formKey.currentState!
                                                .validate()) {
                                              _formKey.currentState!.save();
                                              groupUser.forceUpdateArguments({
                                                'lastUpdate': DateTime.now()
                                                    .millisecondsSinceEpoch
                                              });
                                              print('Saved user data form');
                                              _uploadUserData();
                                              context.go('/chat');
                                            }
                                          },
                                          child:
                                              const Text('''C'est parti !''')))
                                ]));
                          })))))));
}
