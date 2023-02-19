import 'package:go_router/go_router.dart';
import 'package:awachat/store/user.dart';
import 'package:awachat/widgets/loader.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

// ===== ===== =====
// Drawer

class UserDrawer extends StatelessWidget {
  const UserDrawer({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Drawer(
        child: ListView(padding: EdgeInsets.zero, children: <Widget>[
      DrawerHeader(
          child: CircleAvatar(
              backgroundColor: Colors.transparent,
              child: SizedBox(
                  child: ClipOval(child: User.getUserImage(User().id))))),
      ListTile(
          leading: const Icon(Icons.location_city),
          title: const Text('Choisir ma ville'),
          onTap: () => (context.go('/cities'))),
      ListTile(
          leading: const Icon(Icons.account_circle),
          title: const Text('Mettre mon profil à jour'),
          onTap: () => (context.go('/upload-photo'))),
      const Divider(),
      ListTile(
          leading: const Icon(Icons.copyright),
          title: const Text('Voir les sources'),
          onTap: () {
            Navigator.push(context,
                MaterialPageRoute(builder: (context) => const Credits()));
          }),
      ListTile(
          leading: const Icon(Icons.info_outline),
          title: const Text('Nous contacter'),
          subtitle: const Text("Un problème, une suggestion, n'hésite pas !"),
          onTap: () async {
            if (!await launchUrl(Uri.parse('https://awa-chat.me/contact/'))) {
              throw 'Could not launch https://awa-chat.me/contact/';
            }
          })
    ]));
  }
}

// ===== ===== =====
// Credits
class Credits extends StatefulWidget {
  const Credits({Key? key}) : super(key: key);

  @override
  State<Credits> createState() => _CreditsState();
}

class _CreditsState extends State<Credits> {
  late Future<http.Response> text;

  @override
  void initState() {
    super.initState();
    text = http.get(Uri.parse(
        'https://raw.githubusercontent.com/AdrKacz/super-duper-guacamole/main/agreements/credits/fr'));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(
          title: const Text('Sources'),
        ),
        body: FutureBuilder(
            future: text,
            builder: (BuildContext context, AsyncSnapshot snapshot) {
              if (snapshot.hasData) {
                return SafeArea(
                    child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Expanded(
                                  child: SingleChildScrollView(
                                      child: Text(snapshot.data.body,
                                          textAlign: TextAlign.left,
                                          style: const TextStyle(height: 1.5))))
                            ])));
              }
              return const Loader();
            }));
  }
}
