import 'dart:convert';
import 'package:awachat/network/http_connection.dart';
import 'package:awachat/widgets/update_user/name_field.dart';
import 'package:awachat/widgets/update_user/photo_field.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'dart:io';
import 'package:awachat/store/user.dart';
import 'package:flutter/services.dart';
// ignore: depend_on_referenced_packages
import 'package:path/path.dart' as p;

class UpdateUser extends StatefulWidget {
  const UpdateUser({Key? key}) : super(key: key);

  @override
  State<UpdateUser> createState() => _UpdateUserState();
}

class _UpdateUserState extends State<UpdateUser> {
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

  void _uploadUserData() {
    String? imageExtension;
    _getFile(User().getGroupUserArgument(User().id!, 'imagePath'))
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
      body: SafeArea(
          child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Center(
                  child: SingleChildScrollView(
                      child: FutureBuilder(
                          future: _getFile(User()
                              .getGroupUserArgument(User().id!, 'imagePath')),
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
                                    initialValue: snapshot.data,
                                  ),
                                  const NameField(),
                                  Container(
                                      margin: const EdgeInsets.only(top: 12),
                                      child: ElevatedButton(
                                          onPressed: () {
                                            if (_formKey.currentState!
                                                .validate()) {
                                              _uploadUserData();
                                              context.go('/chat');
                                            }
                                          },
                                          child:
                                              const Text('''C'est parti !''')))
                                ]));
                          })))))));
}
